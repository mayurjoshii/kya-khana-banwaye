// Rules checked in code after Gemini answers. The prompt asks for the same
// things, but the model can ignore it; these checks can't be ignored.

import { containsWords, normalizeName, sameIngredient } from "@/lib/normalize";
import { MEAL_LABEL, type Meal, type PlannedDish } from "@/lib/types";

/** Everyday basics that may appear every day without counting as a repeat. */
export const REPEAT_OK = new Set(["roti", "rice", "salad", "curd", "raita", "jeera rice", "green salad"]);

const NON_VEG = [
  "chicken", "mutton", "lamb", "goat", "beef", "pork", "bacon", "ham", "sausage", "salami", "pepperoni",
  "fish", "prawn", "shrimp", "crab", "lobster", "squid", "tuna", "salmon", "sardine", "anchovy", "mackerel",
  "pomfret", "surmai", "bombil", "meat", "keema", "kheema", "gelatin", "murgh", "gosht", "machli", "machhi", "jhinga",
];
/** Words that make a "keema" or "meat" dish vegetarian. */
const VEG_QUALIFIERS = ["soya", "soy", "veg", "paneer", "matar", "mushroom", "jackfruit", "kathal", "plant"];

export function isNonVeg(name: string): boolean {
  const key = normalizeName(name);
  const hit = NON_VEG.find((word) => containsWords(key, word));
  if (!hit) return false;
  return !VEG_QUALIFIERS.some((q) => containsWords(key, q));
}

export interface Blocked {
  key: string;
  label: string;
  /** Hard blocks fail the plan; soft ones become warnings. */
  hard: boolean;
}

export interface RuleInput {
  dishes: PlannedDish[];
  meals: Meal[];
  maxDishesSimple: number;
  maxDishesComplex: number;
  visitMinutes: number;
  recentKeys: string[];
  blocked: Blocked[];
  protein: Partial<Record<Meal, number>>;
  mealProteinMin: number;
}

export interface RuleResult {
  /** Must be fixed: the plan is rejected. */
  hard: string[];
  /** Worth one retry, then shown as a warning. */
  protein: string[];
  /** Shown as warnings. */
  soft: string[];
}

export function dishLimit(dishes: PlannedDish[], maxSimple: number, maxComplex: number): number {
  return dishes.some((d) => d.complexity === "complex") ? maxComplex : maxSimple;
}

export function checkPlan(input: RuleInput): RuleResult {
  const hard: string[] = [];
  const soft: string[] = [];
  const protein: string[] = [];

  // Count each dish once, even when served at two meals.
  const unique = [...new Map(input.dishes.map((d) => [d.key, d])).values()];
  const limit = dishLimit(unique, input.maxDishesSimple, input.maxDishesComplex);
  if (unique.length > limit) {
    const why = unique.some((d) => d.complexity === "complex")
      ? `at least one dish is complex, so the limit is ${limit}`
      : `the limit is ${limit}`;
    hard.push(`${unique.length} dishes is too many: ${why}. Roti, rice and salad count as dishes.`);
  }

  for (const meal of input.meals) {
    if (!unique.some((d) => d.meals.includes(meal))) hard.push(`Nothing is planned for ${MEAL_LABEL[meal].toLowerCase()}.`);
  }
  for (const dish of unique) {
    const extra = dish.meals.filter((m) => !input.meals.includes(m));
    if (extra.length) {
      hard.push(`${dish.name} is for ${extra.map((m) => MEAL_LABEL[m].toLowerCase()).join(" and ")}, which this visit doesn't cover.`);
    }
  }

  for (const dish of unique) {
    const names = [dish.name, ...dish.ingredients.map((i) => i.item)];
    const bad = names.find(isNonVeg);
    if (bad) hard.push(`${dish.name} uses ${bad}. Vegetarian food plus eggs only.`);
  }

  const recent = new Set(input.recentKeys);
  for (const dish of unique) {
    if (recent.has(dish.key) && !REPEAT_OK.has(dish.key)) {
      hard.push(`${dish.name} was already made in the last 7 days.`);
    }
  }

  for (const dish of unique) {
    const keys = [dish.key, ...dish.ingredients.map((i) => normalizeName(i.item))];
    for (const block of input.blocked) {
      if (keys.some((k) => sameIngredient(k, block.key))) {
        const line = `${dish.name} uses ${block.label}, which is on the ${block.hard ? "avoid" : "dislike"} list.`;
        (block.hard ? hard : soft).push(line);
      }
    }
  }

  const minutes = unique.reduce((sum, d) => sum + d.minutes, 0);
  if (minutes > input.visitMinutes) {
    soft.push(`About ${minutes} minutes of cooking for a ${input.visitMinutes}-minute visit.`);
  }

  for (const meal of input.meals) {
    const grams = input.protein[meal] ?? 0;
    if (grams < input.mealProteinMin) {
      protein.push(`${MEAL_LABEL[meal]} gives about ${grams} g protein per person; the target is at least ${input.mealProteinMin} g.`);
    }
  }

  return { hard: [...new Set(hard)], protein, soft: [...new Set(soft)] };
}
