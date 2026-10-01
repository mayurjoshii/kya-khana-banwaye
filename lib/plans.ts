import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCookProfile, getFridge, getPlan, updatePlan } from "@/lib/data";
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
