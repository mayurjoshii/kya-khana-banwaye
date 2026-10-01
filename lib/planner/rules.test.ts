import { describe, expect, it } from "vitest";

import type { PlannedDish } from "@/lib/types";

import { checkPlan, isNonVeg, type RuleInput } from "./rules";

const dish = (name: string, opts: Partial<PlannedDish> = {}): PlannedDish => ({
  key: name.toLowerCase(),
  name,
  name_hi: name,
  meals: ["lunch"],
  complexity: "simple",
  minutes: 15,
  protein_g_total: 40,
  ingredients: [],
  cook_knows: true,
  steps_hi: [],
  ...opts,
});

const base = (dishes: PlannedDish[], extra: Partial<RuleInput> = {}): RuleInput => ({
  dishes,
  meals: ["lunch", "dinner"],
  maxDishesSimple: 4,
  maxDishesComplex: 3,
  visitMinutes: 60,
  recentKeys: [],
  blocked: [],
  protein: { lunch: 28, dinner: 28 },
  mealProteinMin: 25,
  ...extra,
});

describe("isNonVeg", () => {
  it("catches meat and fish in dish or ingredient names", () => {
    expect(isNonVeg("Chicken curry")).toBe(true);
    expect(isNonVeg("Prawns")).toBe(true);
    expect(isNonVeg("Machli fry")).toBe(true);
  });

  it("allows eggs and vegetarian versions", () => {
    expect(isNonVeg("Egg bhurji")).toBe(false);
    expect(isNonVeg("Soya keema")).toBe(false);
    expect(isNonVeg("Paneer tikka")).toBe(false);
  });
});

describe("checkPlan", () => {
  const ok = [dish("Roti", { meals: ["lunch", "dinner"] }), dish("Dal", { meals: ["lunch", "dinner"] }), dish("Paneer bhurji")];

  it("passes a plan within every rule", () => {
    expect(checkPlan(base(ok))).toEqual({ hard: [], protein: [], soft: [] });
  });

  it("limits dishes to 3 when any is complex, counting roti", () => {
    const plan = [...ok, dish("Rice", { meals: ["dinner"] })];
    expect(checkPlan(base(plan)).hard).toEqual([]);
    const complex = plan.map((d, i) => (i === 2 ? { ...d, complexity: "complex" as const } : d));
    expect(checkPlan(base(complex)).hard[0]).toMatch(/4 dishes is too many.*limit is 3/);
  });

  it("counts a dish served at two meals once", () => {
    const twice = [dish("Rajma", { meals: ["lunch", "dinner"], complexity: "complex" }), dish("Rice", { meals: ["lunch", "dinner"] }), dish("Salad")];
    expect(checkPlan(base(twice)).hard).toEqual([]);
  });

  it("requires every meal in the visit and no others", () => {
    const result = checkPlan(base([dish("Poha", { meals: ["snack"] })]));
    expect(result.hard).toContain("Nothing is planned for lunch.");
    expect(result.hard).toContain("Nothing is planned for dinner.");
    expect(result.hard.some((h) => h.includes("snacks, which this visit doesn't cover"))).toBe(true);
  });

  it("rejects non-veg ingredients", () => {
    const plan = [...ok.slice(0, 2), dish("Biryani", { ingredients: [{ item: "chicken", quantity: 300, unit: "g" }] })];
    expect(checkPlan(base(plan)).hard).toContain("Biryani uses chicken. Vegetarian food plus eggs only.");
  });

  it("rejects repeats except everyday basics", () => {
    const result = checkPlan(base(ok, { recentKeys: ["roti", "paneer bhurji"] }));
    expect(result.hard).toEqual(["Paneer bhurji was already made in the last 7 days."]);
  });

  it("treats avoids as hard and mild dislikes as soft", () => {
    const plan = [...ok.slice(0, 2), dish("Egg curry", { ingredients: [{ item: "eggs", quantity: 4, unit: "piece" }] })];
    const result = checkPlan(
      base(plan, {
        blocked: [
          { key: "egg", label: "egg", hard: true },
          { key: "dal", label: "dal", hard: false },
        ],
      }),
    );
    expect(result.hard).toEqual(["Egg curry uses egg, which is on the avoid list."]);
    expect(result.soft).toEqual(["Dal uses dal, which is on the dislike list."]);
  });

  it("flags low protein and long cooking", () => {
    const slow = ok.map((d) => ({ ...d, minutes: 30 }));
    const result = checkPlan(base(slow, { protein: { lunch: 20, dinner: 26 } }));
    expect(result.protein).toEqual(["Lunch gives about 20 g protein per person; the target is at least 25 g."]);
    expect(result.soft).toEqual(["About 90 minutes of cooking for a 60-minute visit."]);
  });
});
