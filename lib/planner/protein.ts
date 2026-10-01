// Protein estimates. Gemini gives a number per dish; this table checks it, since
// model estimates drift. Values are rough, per 100 g as bought (dry for dals).

import { containsWords, normalizeName } from "@/lib/normalize";
import type { Ingredient, Meal, PlannedDish } from "@/lib/types";

export const PROTEIN_PER_100G: Record<string, number> = {
  paneer: 18,
  tofu: 8,
  "soya chunks": 52,
  "soya granules": 52,
  chana: 19,
  "kala chana": 19,
  rajma: 22,
  "chana dal": 20,
  "moong dal": 24,
  "toor dal": 22,
  "masoor dal": 24,
  "urad dal": 25,
  moong: 24,
  sprouts: 9,
  dal: 22,
  besan: 22,
  curd: 3.5,
  "greek yogurt": 10,
  "hung curd": 8,
  milk: 3.4,
  cheese: 25,
  peas: 5,
  spinach: 2.9,
  mushroom: 3,
  broccoli: 2.8,
  atta: 12,
  rice: 7,
  oats: 13,
  poha: 7,
  suji: 10,
  quinoa: 14,
  peanut: 26,
  "peanut butter": 25,
  almond: 21,
  egg: 13,
};

/** Grams of protein per piece, for things counted rather than weighed. */
const PER_PIECE: Record<string, number> = { egg: 6, roti: 3, bread: 3, "egg white": 3.5 };

function lookup(key: string, table: Record<string, number>): number | undefined {
  if (key in table) return table[key];
  let best: string | undefined;
  for (const k of Object.keys(table)) {
    if (containsWords(key, k) && (!best || k.length > best.length)) best = k;
  }
  return best ? table[best] : undefined;
}

/** Protein from ingredients the table knows. `known` is false when none matched. */
export function estimateFromIngredients(ingredients: Ingredient[]): { grams: number; known: boolean } {
  let grams = 0;
  let known = false;
  for (const ing of ingredients) {
    const key = normalizeName(ing.item);
    if (ing.unit === "g" || ing.unit === "ml") {
      const per100 = lookup(key, PROTEIN_PER_100G);
      if (per100 !== undefined) {
        grams += (ing.quantity / 100) * per100;
        known = true;
      }
    } else if (ing.unit === "piece") {
      const each = lookup(key, PER_PIECE);
      if (each !== undefined) {
        grams += ing.quantity * each;
        known = true;
      }
    }
  }
  return { grams: Math.round(grams), known };
}

/**
 * The protein figure to trust for a dish: the model's, unless the table
 * disagrees by more than 40%.
 */
export function reconcileProtein(dish: Pick<PlannedDish, "protein_g_total" | "ingredients">): {
  grams: number;
  adjusted: boolean;
} {
  const table = estimateFromIngredients(dish.ingredients);
  if (!table.known || table.grams === 0) return { grams: Math.round(dish.protein_g_total), adjusted: false };
  const gap = Math.abs(dish.protein_g_total - table.grams) / table.grams;
  return gap > 0.4 ? { grams: table.grams, adjusted: true } : { grams: Math.round(dish.protein_g_total), adjusted: false };
}

/** Protein per person at each meal. A dish served at two meals splits evenly. */
export function proteinByMeal(dishes: PlannedDish[], servings: number): Partial<Record<Meal, number>> {
  const out: Partial<Record<Meal, number>> = {};
  for (const dish of dishes) {
    if (dish.meals.length === 0) continue;
    const share = dish.protein_g_total / dish.meals.length / Math.max(servings, 1);
    for (const meal of dish.meals) out[meal] = (out[meal] ?? 0) + share;
  }
  for (const meal of Object.keys(out) as Meal[]) out[meal] = Math.round(out[meal]!);
  return out;
}
