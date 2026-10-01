import { describe, expect, it } from "vitest";

import type { FridgeItem, PlannedDish } from "@/lib/types";

import { computeMissing, newlyMissing } from "./missing";

const item = (key: string, opts: Partial<FridgeItem> = {}): FridgeItem => ({
  id: key,
  item_key: key,
  display_name: key,
  quantity: "",
  is_staple: false,
  in_stock: true,
  last_confirmed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...opts,
});

const dish = (name: string, ingredients: [string, number, PlannedDish["ingredients"][number]["unit"]][]): PlannedDish => ({
  key: name.toLowerCase(),
  name,
  name_hi: name,
  meals: ["lunch"],
  complexity: "simple",
  minutes: 20,
  protein_g_total: 30,
  ingredients: ingredients.map(([i, quantity, unit]) => ({ item: i, quantity, unit })),
  cook_knows: true,
  steps_hi: [],
});

describe("computeMissing", () => {
  const fridge = [item("onion", { is_staple: true }), item("paneer"), item("spinach", { in_stock: false })];

  it("lists ingredients that are not in stock", () => {
    const missing = computeMissing([dish("Palak paneer", [["Spinach", 250, "g"], ["Paneer", 200, "g"], ["Onion", 1, "piece"]])], fridge);
    expect(missing.map((m) => m.key)).toEqual(["spinach"]);
    expect(missing[0]).toMatchObject({ quantity: "250 g", dishes: ["Palak paneer"], decision: "pending" });
  });

  it("merges the same ingredient across dishes and ignores water", () => {
    const missing = computeMissing(
      [dish("Rajma", [["Rajma", 150, "g"], ["Water", 500, "ml"]]), dish("Rajma rice", [["rajma", 50, "g"]])],
      fridge,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ key: "rajma", quantity: "150 g + 50 g", dishes: ["Rajma", "Rajma rice"] });
  });

  it("keeps earlier buy or swap decisions", () => {
    const missing = computeMissing([dish("Palak", [["spinach", 1, "bunch"]])], fridge, [
      { key: "spinach", item: "spinach", quantity: "", dishes: [], decision: "buy" },
    ]);
    expect(missing[0].decision).toBe("buy");
  });

  it("reports only newly missing items", () => {
    const before = [{ key: "a", item: "a", quantity: "", dishes: [], decision: "pending" as const }];
    const after = [...before, { key: "b", item: "b", quantity: "", dishes: [], decision: "pending" as const }];
    expect(newlyMissing(before, after).map((m) => m.key)).toEqual(["b"]);
  });
});
