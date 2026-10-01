// Plain-text plan summaries for Telegram. Pure, so the format is easy to test.

import { MEAL_LABEL, MEALS_FOR_MODE, type MealPlan } from "@/lib/types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function planSummaryHtml(plan: Pick<MealPlan, "plan_date" | "mode" | "dishes" | "protein" | "missing_items" | "warnings">, dayLabel: string): string {
  const lines = [`<b>Plan for ${esc(dayLabel)}</b>`];
  for (const meal of MEALS_FOR_MODE[plan.mode]) {
    const dishes = plan.dishes.filter((d) => d.meals.includes(meal));
    if (!dishes.length) continue;
    const protein = plan.protein[meal];
    lines.push(
      `\n<b>${MEAL_LABEL[meal]}</b>${protein ? ` · ~${protein} g protein each` : ""}`,
      ...dishes.map((d) => `• ${esc(d.name)}${d.cook_knows ? "" : " (steps included)"}`),
    );
  }
  const pending = plan.missing_items.filter((m) => m.decision !== "swap");
  if (pending.length) {
    lines.push(
      `\n<b>To buy</b>`,
      ...pending.map((m) => `• ${esc(m.item)}${m.quantity ? ` (${esc(m.quantity)})` : ""}${m.decision === "buy" ? " · buying" : ""}`),
    );
  }
  if (plan.warnings.length) lines.push(`\n<b>Heads up</b>`, ...plan.warnings.map((w) => `• ${esc(w)}`));
  return lines.join("\n");
}
