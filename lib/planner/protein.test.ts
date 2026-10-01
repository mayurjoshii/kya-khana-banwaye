import { describe, expect, it } from "vitest";

import type { PlannedDish } from "@/lib/types";

import { estimateFromIngredients, proteinByMeal, reconcileProtein } from "./protein";

describe("estimateFromIngredients", () => {
  it("adds known ingredients by weight and by piece", () => {
    const result = estimateFromIngredients([
      { item: "Paneer", quantity: 200, unit: "g" },
      { item: "Eggs", quantity: 4, unit: "piece" },
      { item: "Onion", quantity: 1, unit: "piece" },
    ]);
    expect(result).toEqual({ grams: 60, known: true });
  });

  it("matches qualified names to the closest entry", () => {
    expect(estimateFromIngredients([{ item: "malai paneer", quantity: 100, unit: "g" }]).grams).toBe(18);
    expect(estimateFromIngredients([{ item: "moong dal", quantity: 100, unit: "g" }]).grams).toBe(24);
  });

  it("reports unknown when nothing matches", () => {
    expect(estimateFromIngredients([{ item: "bhindi", quantity: 250, unit: "g" }])).toEqual({ grams: 0, known: false });
  });
});

describe("reconcileProtein", () => {
  const ingredients = [{ item: "paneer", quantity: 200, unit: "g" as const }];

  it("keeps the model's number when close", () => {
    expect(reconcileProtein({ protein_g_total: 40, ingredients })).toEqual({ grams: 40, adjusted: false });
  });

  it("uses the table when the model is far off", () => {
    expect(reconcileProtein({ protein_g_total: 90, ingredients })).toEqual({ grams: 36, adjusted: true });
  });
});

describe("proteinByMeal", () => {
  it("splits dishes across meals and servings", () => {
    const dishes = [
      { meals: ["lunch", "dinner"], protein_g_total: 60 },
      { meals: ["lunch"], protein_g_total: 20 },
    ] as PlannedDish[];
    expect(proteinByMeal(dishes, 2)).toEqual({ lunch: 25, dinner: 15 });
  });
});
