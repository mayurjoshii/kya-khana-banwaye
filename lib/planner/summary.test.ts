import { describe, expect, it } from "vitest";

import type { PlannedDish } from "@/lib/types";

import { planSummaryHtml } from "./summary";

const dish = (name: string, meals: PlannedDish["meals"], cook_knows = true): PlannedDish => ({
  key: name.toLowerCase(),
  name,
  name_hi: name,
  meals,
  complexity: "simple",
  minutes: 15,
  protein_g_total: 30,
  ingredients: [],
  cook_knows,
  steps_hi: [],
});

describe("planSummaryHtml", () => {
  it("groups dishes by meal and lists what to buy", () => {
    const html = planSummaryHtml(
      {
        plan_date: "2026-10-03",
        mode: "lunch_dinner",
        dishes: [dish("Roti", ["lunch", "dinner"]), dish("Palak <paneer>", ["lunch"], false)],
        protein: { lunch: 27, dinner: 26 },
        missing_items: [
          { key: "spinach", item: "Spinach", quantity: "250 g", dishes: ["Palak paneer"], decision: "pending" },
          { key: "x", item: "Swapped", quantity: "", dishes: [], decision: "swap" },
        ],
        warnings: [],
      },
      "Sat 3 Oct",
    );
    expect(html).toContain("<b>Lunch</b> · ~27 g protein each");
    expect(html).toContain("• Palak &lt;paneer&gt; (steps included)");
    expect(html).toContain("• Spinach (250 g)");
    expect(html).not.toContain("Swapped");
  });
});
