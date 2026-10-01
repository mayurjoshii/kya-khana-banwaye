import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlan, getRecipes, saveRecipes, startPlan, updatePlan } from "@/lib/data";
import { callJson } from "@/lib/llm/gemini";
import { MENU_SYSTEM, menuPrompt, recipeStepsPrompt, recipeStepsSystem } from "@/lib/llm/prompts";
import { MenuSchema, RecipeStepsSchema, type Menu } from "@/lib/llm/schemas";
import { normalizeName } from "@/lib/normalize";
import { appLink, escapeHtml, sendMessage } from "@/lib/notify/telegram";
import { formatDay } from "@/lib/time";
import { MEAL_LABEL, type MealPlan, type PlannedDish, type Recipe, type VisitMode } from "@/lib/types";

import { buildContext, type PlanContext } from "./context";
import { computeMissing } from "./missing";
import { proteinByMeal, reconcileProtein } from "./protein";
import { checkPlan } from "./rules";
import { planSummaryHtml } from "./summary";

export class PlanRulesError extends Error {
  constructor(public readonly problems: string[]) {
    super(`The planner could not meet the rules after a retry:\n- ${problems.join("\n- ")}`);
    this.name = "PlanRulesError";
  }
}

function toDishes(menu: Menu, ctx: PlanContext): { dishes: PlannedDish[]; adjusted: string[] } {
  const adjusted: string[] = [];
  const dishes = menu.dishes.map((d) => {
    const key = normalizeName(d.name);
    const protein = reconcileProtein(d);
    if (protein.adjusted) adjusted.push(d.name);
    return {
      key,
      name: d.name.trim(),
      name_hi: d.name_hi.trim(),
      meals: [...new Set(d.meals)],
      complexity: d.complexity,
      minutes: d.minutes,
      protein_g_total: protein.grams,
      ingredients: d.ingredients,
      cook_knows: ctx.skills.some((s) => s.dish_key === key && s.knows),
      steps_hi: [],
    } satisfies PlannedDish;
  });
  return { dishes, adjusted };
}

async function proposeMenu(db: SupabaseClient, ctx: PlanContext) {
  const base = {
    date: formatDay(ctx.date),
    mealsLabel: ctx.meals.map((m) => MEAL_LABEL[m].toLowerCase()).join(" + "),
    servings: ctx.cook.servings,
    visitTime: ctx.cook.visit_time.slice(0, 5),
    visitMinutes: ctx.cook.visit_minutes,
    maxSimple: ctx.cook.max_dishes_simple,
    maxComplex: ctx.cook.max_dishes_complex,
    mealProteinMin: ctx.mealProteinMin,
    mealProteinMax: ctx.mealProteinMax,
    fridge: ctx.fridge
      .filter((f) => f.in_stock && !f.is_staple)
      .map((f) => (f.quantity ? `${f.display_name} (${f.quantity})` : f.display_name)),
    staples: ctx.fridge.filter((f) => f.in_stock && f.is_staple).map((f) => f.display_name),
    likes: ctx.preferences
      .filter((p) => p.kind === "like" || p.kind === "craving")
      .map((p) => (p.kind === "craving" ? `${p.item} (craving)` : p.item)),
    avoid: ctx.blocked.filter((b) => b.hard).map((b) => b.label),
    rules: ctx.rules.map((r) => ({ rule: r.rule, kind: r.kind })),
    knownDishes: ctx.skills.filter((s) => s.knows).map((s) => s.display_name),
    recent: ctx.recent,
    feedback: ctx.feedback,
    note: [ctx.overrideNote, ...ctx.preferences.filter((p) => p.kind === "note").map((p) => p.item), ...ctx.people.map((p) => p.notes)]
      .filter(Boolean)
      .join(" "),
  };

  let retryProblems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const menu = await callJson({
      db,
      purpose: attempt === 1 ? "plan" : "plan-retry",
      schema: MenuSchema,
      system: MENU_SYSTEM,
      prompt: menuPrompt({ ...base, retryProblems }),
    });
    const { dishes, adjusted } = toDishes(menu, ctx);
    const protein = proteinByMeal(dishes, ctx.cook.servings);
    const result = checkPlan({
      dishes,
      meals: ctx.meals,
      maxDishesSimple: ctx.cook.max_dishes_simple,
      maxDishesComplex: ctx.cook.max_dishes_complex,
      visitMinutes: ctx.cook.visit_minutes,
      recentKeys: ctx.recentKeys,
      blocked: ctx.blocked,
      protein,
      mealProteinMin: ctx.mealProteinMin,
    });
    // Protein misses get one retry; after that they're a warning, not a failure.
    const mustFix = attempt === 1 ? [...result.hard, ...result.protein] : result.hard;
    if (mustFix.length === 0) {
      const warnings = [...result.soft, ...result.protein];
      if (adjusted.length) warnings.push(`Protein for ${adjusted.join(", ")} was re-estimated from the ingredients.`);
      return { dishes, protein, warnings };
    }
    retryProblems = mustFix;
  }
  throw new PlanRulesError(retryProblems);
}

/** Adds steps to dishes the cook doesn't know, from the cache or one Gemini call. */
async function addSteps(db: SupabaseClient, ctx: PlanContext, dishes: PlannedDish[]): Promise<PlannedDish[]> {
  const cached = await getRecipes(db, dishes.map((d) => d.key));
  const byKey = new Map(cached.map((r) => [r.dish_key, r]));
  const needSteps = dishes.filter((d) => !d.cook_knows && !(byKey.get(d.key)?.steps_hi.length));

  const generated = new Map<string, string[]>();
  if (needSteps.length) {
    const result = await callJson({
      db,
      purpose: "recipe-steps",
      schema: RecipeStepsSchema,
      system: recipeStepsSystem(ctx.cook.language),
      prompt: recipeStepsPrompt(ctx.cook.servings, needSteps),
    });
    for (const r of result.recipes) generated.set(normalizeName(r.name), r.steps_hi);
  }

  // Cache every dish so a known dish never needs generating again.
  const toSave: Recipe[] = dishes
    .filter((d) => !byKey.has(d.key) || generated.has(d.key))
    .map((d) => ({
      dish_key: d.key,
      display_name: d.name,
      display_name_hi: d.name_hi,
      complexity: d.complexity,
      minutes: d.minutes,
      protein_g_per_serving: Math.round(d.protein_g_total / Math.max(ctx.cook.servings, 1)),
      ingredients: d.ingredients,
      steps_hi: generated.get(d.key) ?? byKey.get(d.key)?.steps_hi ?? [],
    }));
  await saveRecipes(db, toSave);

  return dishes.map((d) =>
    d.cook_knows ? d : { ...d, steps_hi: generated.get(d.key) ?? byKey.get(d.key)?.steps_hi ?? [] },
  );
}

export interface RunPlanOptions {
  mode?: VisitMode;
  /** Ingredients or dishes to leave out (from a Swap). */
  exclude?: string[];
  /** Send the plan summary to Telegram when done. */
  notify?: boolean;
}

/**
 * Plans the visit on `date`: menu, rule checks, steps, missing items. The plan
 * row ends `planned` or `failed`; a failure also pings Telegram.
 */
export async function runPlan(db: SupabaseClient, date: string, opts: RunPlanOptions = {}): Promise<MealPlan> {
  const existing = await getPlan(db, date);
  if (existing?.status === "sent") throw new Error("This visit's plan was already sent to the cook.");
  const ctx = await buildContext(db, date, opts);
  const row = await startPlan(db, date, ctx.mode);
  try {
    const proposal = await proposeMenu(db, ctx);
    const dishes = await addSteps(db, ctx, proposal.dishes);
    const missing = computeMissing(dishes, ctx.fridge, ctx.previousMissing);
    const patch: Partial<MealPlan> = {
      mode: ctx.mode,
      dishes,
      protein: proposal.protein,
      missing_items: missing,
      warnings: proposal.warnings,
      status: "planned",
      error: null,
      script_hi: null,
      audio_path: null,
      version: row.version + 1,
      sent_at: null,
    };
    await updatePlan(db, row.id, patch);
    const plan = { ...row, ...patch } as MealPlan;
    if (opts.notify) {
      await sendMessage(planSummaryHtml(plan, formatDay(date)), [{ text: "Open the plan", url: appLink("/") }]);
    }
    return plan;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updatePlan(db, row.id, { status: "failed", error: message });
    await sendMessage(
      `<b>Planning failed for ${escapeHtml(formatDay(date))}</b>\n${escapeHtml(message).slice(0, 800)}\n\nOpen the app to try again, or send the cook a quick text menu.`,
      [{ text: "Open the app", url: appLink("/") }],
    );
    const failed = await getPlan(db, date);
    if (failed) return failed;
    throw err;
  }
}
