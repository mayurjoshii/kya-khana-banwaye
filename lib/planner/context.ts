import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getActivePreferences,
  getCookProfile,
  getCookRules,
  getCookSkills,
  getFeedback,
  getFridge,
  getPeople,
  getPlan,
  getRecentPlans,
  getVisitOverride,
} from "@/lib/data";
import { normalizeName } from "@/lib/normalize";
import { MEALS_FOR_MODE, type CookProfile, type CookRule, type CookSkill, type FridgeItem, type Meal, type MissingItem, type Person, type Preference, type VisitMode } from "@/lib/types";

import type { Blocked } from "./rules";

export interface PlanContext {
  date: string;
  mode: VisitMode;
  meals: Meal[];
  cook: CookProfile;
  people: Person[];
  preferences: Preference[];
  rules: CookRule[];
  skills: CookSkill[];
  fridge: FridgeItem[];
  recent: { date: string; dishes: string[] }[];
  recentKeys: string[];
  blocked: Blocked[];
  feedback: string[];
  overrideNote: string;
  /** Missing-item decisions from the previous version of this plan. */
  previousMissing: MissingItem[];
  mealProteinMin: number;
  mealProteinMax: number;
}

/** Everything the planner needs for one visit, and nothing more. */
export async function buildContext(
  db: SupabaseClient,
  date: string,
  opts: { mode?: VisitMode; exclude?: string[] } = {},
): Promise<PlanContext> {
  const [cook, people, preferences, rules, skills, fridge, recentPlans, override, feedbackRows, existing] =
    await Promise.all([
      getCookProfile(db),
      getPeople(db),
      getActivePreferences(db),
      getCookRules(db, true),
      getCookSkills(db),
      getFridge(db),
      getRecentPlans(db, date, 7),
      getVisitOverride(db, date),
      getFeedback(db, 8),
      getPlan(db, date),
    ]);

  const mode = opts.mode ?? override?.mode ?? existing?.mode ?? cook.default_mode;
  const recent = recentPlans
    .filter((p) => p.status !== "failed" && p.dishes.length > 0)
    .map((p) => ({ date: p.plan_date, dishes: p.dishes.map((d) => d.name) }));

  const previousMissing = existing?.missing_items ?? [];
  const swapped = previousMissing.filter((m) => m.decision === "swap");
  const blocked: Blocked[] = [
    ...preferences
      .filter((p) => p.kind === "avoid" || p.kind === "dislike")
      .map((p) => ({ key: p.item_key, label: p.item, hard: p.kind === "avoid" || p.strength >= 2 })),
    ...swapped.map((m) => ({ key: m.key, label: m.item, hard: true })),
    ...(opts.exclude ?? []).map((item) => ({ key: normalizeName(item), label: item, hard: true })),
  ];

  const recentIds = new Set(recentPlans.map((p) => p.id));
  const feedback = feedbackRows
    .filter((f) => recentIds.has(f.plan_id) && (f.notes || f.cook_issue || f.rating))
    .map((f) => {
      const plan = recentPlans.find((p) => p.id === f.plan_id);
      const parts = [
        plan ? `${plan.plan_date} (${plan.dishes.map((d) => d.name).join(", ")})` : "",
        f.rating ? `rated ${f.rating}/5` : "",
        f.cook_issue ? `cook issue: ${f.cook_issue}` : "",
        f.notes ? `notes: ${f.notes}` : "",
      ];
      return parts.filter(Boolean).join("; ");
    });

  return {
    date,
    mode,
    meals: MEALS_FOR_MODE[mode],
    cook,
    people,
    preferences,
    rules,
    skills,
    fridge,
    recent,
    recentKeys: recentPlans.flatMap((p) => p.dishes.map((d) => d.key)),
    blocked,
    feedback,
    overrideNote: override?.note ?? "",
    previousMissing: previousMissing.filter((m) => m.decision !== "swap"),
    // Plan for the person with the higher target; both eat the same food.
    mealProteinMin: people.length ? Math.max(...people.map((p) => p.meal_protein_min_g)) : 25,
    mealProteinMax: people.length ? Math.max(...people.map((p) => p.meal_protein_max_g)) : 30,
  };
}
