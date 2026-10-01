import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCookProfile, getCookSkills, getFridge, getPlan, getPlanById, updatePlan } from "@/lib/data";
import { normalizeName, sameIngredient } from "@/lib/normalize";
import { appLink, escapeHtml, sendMessage } from "@/lib/notify/telegram";
import { computeMissing, newlyMissing } from "@/lib/planner/missing";
import { upcomingVisitDate } from "@/lib/time";
import type { MealPlan } from "@/lib/types";

/** Plans that can still change: made, but not sent yet. */
export const isOpen = (plan: MealPlan | null): plan is MealPlan =>
  Boolean(plan && ["planned", "audio_ready", "stale"].includes(plan.status));

export async function getUpcomingPlan(db: SupabaseClient): Promise<{ date: string; plan: MealPlan | null }> {
  const cook = await getCookProfile(db);
  const date = upcomingVisitDate(cook.visit_time, cook.visit_minutes);
  return { date, plan: await getPlan(db, date) };
}

/**
 * Called after any fridge change. Items that arrived drop off the missing
 * list (no LLM call). If something the plan needs is gone, the plan goes stale.
 */
export async function afterFridgeChange(db: SupabaseClient) {
  const { plan } = await getUpcomingPlan(db);
  if (!isOpen(plan)) return;
  const fridge = await getFridge(db);
  const missing = computeMissing(plan.dishes, fridge, plan.missing_items);
  const lost = newlyMissing(plan.missing_items, missing);
  if (lost.length === 0) {
    await updatePlan(db, plan.id, { missing_items: missing });
    return;
  }
  const names = lost.map((m) => m.item).join(", ");
  await updatePlan(db, plan.id, {
    missing_items: missing,
    status: "stale",
    error: `Now missing: ${names}. Buy them or regenerate the plan.`,
  });
  await sendMessage(
    `<b>Plan needs a look</b>\nThe fridge no longer has: ${escapeHtml(names)}.\nBuy them, or open the app and regenerate.`,
    [{ text: "Open today's plan", url: appLink("/") }],
  );
}

/**
 * Marks the plan for `date` stale. With `conflictKeys`, only when a dish or
 * ingredient matches one of them.
 */
export async function markUpcomingPlanStale(
  db: SupabaseClient,
  date: string,
  reason: string,
  conflictKeys?: string[],
) {
  const plan = await getPlan(db, date);
  if (!isOpen(plan)) return;
  if (conflictKeys) {
    const used = plan.dishes.flatMap((d) => [d.key, ...d.ingredients.map((i) => normalizeName(i.item))]);
    const clash = conflictKeys.some((k) => used.some((u) => sameIngredient(u, k)));
    if (!clash) return;
  }
  await updatePlan(db, plan.id, { status: "stale", error: reason });
}

/** Times a dish is cooked from steps before the cook counts as knowing it. */
export const LEARNED_AFTER = 2;

/**
 * Marks a plan as sent to the cook. Its non-staple ingredients are marked used
 * up (so tomorrow's plan doesn't count on them), and dishes she cooked from
 * steps move towards "known".
 */
export async function markSent(db: SupabaseClient, planId: string) {
  const plan = await getPlanById(db, planId);
  if (!plan || plan.status === "sent") return;
  const now = new Date().toISOString();
  await updatePlan(db, plan.id, { status: "sent", sent_at: now, error: null });

  const fridge = await getFridge(db);
  const used = plan.dishes.flatMap((d) => d.ingredients.map((i) => normalizeName(i.item)));
  const usedUp = fridge.filter((f) => !f.is_staple && f.in_stock && used.some((k) => sameIngredient(f.item_key, k)));
  if (usedUp.length) {
    await db
      .from("fridge_items")
      .update({ in_stock: false, quantity: "", updated_at: now })
      .in("id", usedUp.map((f) => f.id));
  }

  const withSteps = plan.dishes.filter((d) => !d.cook_knows && d.steps_hi.length > 0);
  if (withSteps.length) {
    const skills = await getCookSkills(db);
    await db.from("cook_skills").upsert(
      withSteps.map((d) => {
        const times = (skills.find((s) => s.dish_key === d.key)?.times_cooked_with_steps ?? 0) + 1;
        return {
          dish_key: d.key,
          display_name: d.name,
          times_cooked_with_steps: times,
          knows: times >= LEARNED_AFTER,
          updated_at: now,
        };
      }),
    );
  }
}
