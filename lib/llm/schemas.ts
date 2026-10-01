// Shapes Gemini must return. Each one is also sent to Gemini as a JSON schema.

import { z } from "zod";

import { UNITS } from "@/lib/types";

const person = z.enum(["me", "partner", "both"]);

export const ExtractionSchema = z.object({
  transcript: z
    .string()
    .describe("For audio: what was said, word for word. For text: the text as given."),
  preferences: z.array(
    z.object({
      person,
      kind: z.enum(["like", "dislike", "craving", "avoid", "note"]),
      item: z.string().describe("A food, dish or ingredient, in English, singular."),
      expiry: z.enum(["today", "tomorrow", "week", "permanent"]),
      strength: z.number().int().min(1).max(3),
    }),
  ),
  fridge: z.array(
    z.object({
      item: z.string().describe("Ingredient name in English, singular, no quantity."),
      quantity: z.string().describe('As said, e.g. "500 g", "6", "half packet". Empty if not said.'),
      action: z.enum(["add", "used_up", "out"]),
    }),
  ),
  goal_changes: z.array(
    z.object({
      person,
      protein_min_g: z.number().int().nullable(),
      protein_max_g: z.number().int().nullable(),
    }),
  ),
  cook_rules: z.array(z.object({ rule: z.string(), kind: z.enum(["hard", "soft"]) })),
  cook_skills: z.array(
    z.object({
      dish: z.string(),
      knows: z.boolean().describe("true if the cook already knows how to make it."),
    }),
  ),
  mode_for_next_visit: z
    .enum(["lunch_dinner", "lunch_snacks"])
    .nullable()
    .describe("Only if the note says what the next visit should cover."),
  unhandled: z.string().describe("Anything in the note that fits none of the fields. Empty if none."),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const ingredient = z.object({
  item: z.string().describe("English ingredient name, singular, no quantity."),
  quantity: z.number().min(0),
  unit: z.enum(UNITS),
});

export const MenuSchema = z.object({
  dishes: z
    .array(
      z.object({
        name: z.string().describe("Common Indian home name in English letters, e.g. Palak paneer."),
        name_hi: z.string().describe("The same name in Hindi (Devanagari)."),
        meals: z.array(z.enum(["lunch", "dinner", "snack"])).min(1),
        complexity: z.enum(["simple", "complex"]),
        minutes: z.number().int().min(1).describe("Hands-on cooking time."),
        protein_g_total: z
          .number()
          .min(0)
          .describe("Protein in grams for the full quantity cooked (all servings, all meals)."),
        ingredients: z.array(ingredient).min(1),
      }),
    )
    .min(1),
  reasoning: z.string().describe("One or two sentences on why this menu fits."),
});
export type Menu = z.infer<typeof MenuSchema>;

export const RecipeStepsSchema = z.object({
  recipes: z.array(
    z.object({
      name: z.string().describe("Exactly the dish name given."),
      steps_hi: z
        .array(z.string())
        .min(2)
        .max(8)
        .describe("Short Hindi steps, one action each, household units (कटोरी, चम्मच)."),
    }),
  ),
});
export type RecipeSteps = z.infer<typeof RecipeStepsSchema>;

export const ScriptSchema = z.object({
  script_hi: z.string().describe("The full Hindi voice note, one sentence per line."),
});
