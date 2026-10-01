import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ExtractionSchema, MenuSchema, RecipeStepsSchema, ScriptSchema } from "./schemas";

describe("Gemini schemas", () => {
  it.each([
    ["extraction", ExtractionSchema],
    ["menu", MenuSchema],
    ["recipe steps", RecipeStepsSchema],
    ["script", ScriptSchema],
  ])("%s converts to a JSON schema", (_name, schema) => {
    const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
    expect(json.type).toBe("object");
    expect(json.properties).toBeTruthy();
  });

  it("accepts a typical extraction", () => {
    const parsed = ExtractionSchema.safeParse({
      transcript: "bought paneer, no eggs tomorrow",
      preferences: [{ person: "both", kind: "avoid", item: "egg", expiry: "tomorrow", strength: 2 }],
      fridge: [{ item: "paneer", quantity: "500 g", action: "add" }],
      goal_changes: [],
      cook_rules: [],
      cook_skills: [],
      mode_for_next_visit: null,
      unhandled: "",
    });
    expect(parsed.success).toBe(true);
  });
});
