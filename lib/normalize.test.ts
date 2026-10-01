import { describe, expect, it } from "vitest";

import { containsWords, normalizeName, sameIngredient } from "./normalize";

describe("normalizeName", () => {
  it("drops quantities, case and punctuation", () => {
    expect(normalizeName("Paneer 200g")).toBe("paneer");
    expect(normalizeName("  Spinach (1 bunch) ")).toBe("spinach");
    expect(normalizeName("Toor-dal")).toBe("toor dal");
  });

  it("maps common Hindi and English synonyms", () => {
    expect(normalizeName("Dahi")).toBe("curd");
    expect(normalizeName("Eggs")).toBe("egg");
    expect(normalizeName("Chapati")).toBe("roti");
    expect(normalizeName("Shimla Mirch")).toBe("capsicum");
  });

  it("keeps dish names as written", () => {
    expect(normalizeName("Aloo Gobi")).toBe("aloo gobi");
  });
});

describe("sameIngredient", () => {
  it("matches qualified names and plurals", () => {
    expect(sameIngredient("paneer", "malai paneer")).toBe(true);
    expect(sameIngredient("tomatoes", "tomato")).toBe(true);
    expect(sameIngredient("rice", "basmati rice")).toBe(true);
  });

  it("does not match partial words", () => {
    expect(sameIngredient("oil", "boiled egg")).toBe(false);
    expect(containsWords("peanut", "pea")).toBe(false);
  });
});
