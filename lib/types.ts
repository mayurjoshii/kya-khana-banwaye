// Row and domain types, written by hand to match supabase/migrations.

export type PreferenceKind = "like" | "dislike" | "craving" | "avoid" | "note";
export type InputSource = "text" | "voice";
export type RuleKind = "hard" | "soft";
export type VisitMode = "lunch_dinner" | "lunch_snacks";
export type Complexity = "simple" | "complex";
export type PlanStatus = "planning" | "planned" | "audio_ready" | "sent" | "failed" | "stale";
export type Meal = "lunch" | "dinner" | "snack";
export type MissingDecision = "pending" | "buy" | "swap";

export const UNITS = ["g", "ml", "piece", "cup", "tbsp", "tsp", "bunch", "pinch"] as const;
export type Unit = (typeof UNITS)[number];

export interface Person {
  id: string;
  role: "me" | "partner";
  name: string;
  protein_min_g: number;
  protein_max_g: number;
  meal_protein_min_g: number;
  meal_protein_max_g: number;
  notes: string;
}

export interface UserInput {
  id: string;
  text: string;
  source: InputSource;
  created_at: string;
  processed_at: string | null;
  extraction: unknown;
  error: string | null;
}

export interface Preference {
  id: string;
  person_id: string | null;
  kind: PreferenceKind;
  item: string;
  item_key: string;
  strength: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface CookProfile {
  id: 1;
  name: string;
  visit_time: string;
  visit_minutes: number;
  max_dishes_simple: number;
  max_dishes_complex: number;
  servings: number;
  language: string;
  default_mode: VisitMode;
}

export interface CookRule {
  id: string;
  rule: string;
  kind: RuleKind;
  active: boolean;
  created_at: string;
}

export interface CookSkill {
  dish_key: string;
  display_name: string;
  knows: boolean;
  times_cooked_with_steps: number;
  notes: string;
}

export interface FridgeItem {
  id: string;
  item_key: string;
  display_name: string;
  quantity: string;
  is_staple: boolean;
  in_stock: boolean;
  last_confirmed_at: string;
  updated_at: string;
}

export interface Ingredient {
  item: string;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  dish_key: string;
  display_name: string;
  display_name_hi: string;
  complexity: Complexity;
  minutes: number;
  protein_g_per_serving: number;
  ingredients: Ingredient[];
  steps_hi: string[];
}

export interface VisitOverride {
  plan_date: string;
  mode: VisitMode | null;
  note: string;
}

export interface PlannedDish {
  key: string;
  name: string;
  name_hi: string;
  meals: Meal[];
  complexity: Complexity;
  minutes: number;
  /** For all servings, across every meal the dish is served at. */
  protein_g_total: number;
  ingredients: Ingredient[];
  cook_knows: boolean;
  steps_hi: string[];
}

export interface MissingItem {
  key: string;
  item: string;
  quantity: string;
  dishes: string[];
  decision: MissingDecision;
}

/** Protein per person, per meal, in grams. */
export type ProteinByMeal = Partial<Record<Meal, number>>;

export interface MealPlan {
  id: string;
  plan_date: string;
  mode: VisitMode;
  dishes: PlannedDish[];
  missing_items: MissingItem[];
  protein: ProteinByMeal;
  warnings: string[];
  status: PlanStatus;
  error: string | null;
  script_hi: string | null;
  audio_path: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface PlanFeedback {
  id: string;
  plan_id: string;
  rating: number | null;
  cook_issue: string;
  notes: string;
  created_at: string;
}

export interface LlmLog {
  id: string;
  purpose: string;
  model: string;
  prompt: string;
  response: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: "ok" | "invalid" | "error";
  error: string | null;
  created_at: string;
}

export const MEALS_FOR_MODE: Record<VisitMode, Meal[]> = {
  lunch_dinner: ["lunch", "dinner"],
  lunch_snacks: ["lunch", "snack"],
};

export const MEAL_LABEL: Record<Meal, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export const MODE_LABEL: Record<VisitMode, string> = {
  lunch_dinner: "Lunch + dinner",
  lunch_snacks: "Lunch + snacks",
};
