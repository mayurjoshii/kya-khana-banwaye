// Which plan ingredients aren't in the fridge. Pure, so it's unit tested and
// cheap to rerun on every fridge change (no LLM call).

import { normalizeName, sameIngredient } from "@/lib/normalize";
import type { FridgeItem, MissingItem, PlannedDish } from "@/lib/types";

/** Never worth an alert. */
const IGNORE = new Set(["water", "hot water", "ice"]);

export function isInStock(key: string, fridge: FridgeItem[]): boolean {
  return fridge.some((f) => f.in_stock && sameIngredient(f.item_key, key));
}

export function computeMissing(
  dishes: PlannedDish[],
  fridge: FridgeItem[],
  previous: MissingItem[] = [],
): MissingItem[] {
  const byKey = new Map<string, MissingItem & { parts: string[] }>();
  for (const dish of dishes) {
    for (const ing of dish.ingredients) {
      const key = normalizeName(ing.item);
      if (!key || IGNORE.has(key) || isInStock(key, fridge)) continue;
      const entry = byKey.get(key) ?? {
        key,
        item: ing.item,
        quantity: "",
        dishes: [],
        decision: previous.find((p) => p.key === key)?.decision ?? "pending",
        parts: [],
      };
      if (ing.quantity > 0) entry.parts.push(`${formatQty(ing.quantity)} ${ing.unit}`);
      if (!entry.dishes.includes(dish.name)) entry.dishes.push(dish.name);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].map(({ parts, ...item }) => ({ ...item, quantity: parts.join(" + ") }));
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** Keys that are missing now but weren't before: the fridge lost something the plan needs. */
export function newlyMissing(before: MissingItem[], after: MissingItem[]): MissingItem[] {
  const had = new Set(before.map((m) => m.key));
  return after.filter((m) => !had.has(m.key));
}
