// Reads and writes shared by pages, server actions and cron routes. Every
// function takes the client, so the same code runs as the owner (RLS) or as
// the service role (cron).

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeName } from "@/lib/normalize";
import { addDays } from "@/lib/time";
import type {
  CookProfile,
  CookRule,
  CookSkill,
  FridgeItem,
  LlmLog,
  MealPlan,
  Person,
  PlanFeedback,
  Preference,
  Recipe,
  UserInput,
  VisitOverride,
} from "@/lib/types";

type Db = SupabaseClient;

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

// People and preferences ------------------------------------------------------

export async function getPeople(db: Db): Promise<Person[]> {
  return must(await db.from("people").select("*").order("role"), "Load people");
}

export async function getActivePreferences(db: Db): Promise<Preference[]> {
  const rows: Preference[] = must(
    await db
      .from("preferences")
      .select("*")
      .eq("active", true)
      .order("strength", { ascending: false })
      .order("created_at", { ascending: false }),
    "Load preferences",
  );
  const now = Date.now();
  return rows.filter((p) => !p.expires_at || Date.parse(p.expires_at) > now);
}

export async function addPreference(
  db: Db,
  pref: Pick<Preference, "kind" | "item" | "person_id" | "strength" | "expires_at"> & {
    source_input_id?: string | null;
  },
) {
  must(
    await db.from("preferences").insert({ ...pref, item_key: normalizeName(pref.item) }),
    "Save preference",
  );
}

// Cook ------------------------------------------------------------------------

export async function getCookProfile(db: Db): Promise<CookProfile> {
  const row: CookProfile | null = must(
    await db.from("cook_profile").select("*").eq("id", 1).maybeSingle(),
    "Load cook profile",
  );
  if (!row) throw new Error("Cook profile is missing. Run supabase/seed.sql.");
  return row;
}

export async function getCookRules(db: Db, onlyActive = false): Promise<CookRule[]> {
  let query = db.from("cook_rules").select("*").order("created_at");
  if (onlyActive) query = query.eq("active", true);
  return must(await query, "Load cook rules");
}

export async function getCookSkills(db: Db): Promise<CookSkill[]> {
  return must(await db.from("cook_skills").select("*").order("display_name"), "Load cook skills");
}

// Fridge ----------------------------------------------------------------------

export async function getFridge(db: Db): Promise<FridgeItem[]> {
  return must(await db.from("fridge_items").select("*").order("display_name"), "Load fridge");
}

export type FridgeAction = "add" | "used_up" | "out";

/** Applies one change to the fridge by item name. Returns the item key. */
export async function applyFridgeChange(
  db: Db,
  change: { item: string; quantity?: string; action: FridgeAction },
): Promise<string> {
  const key = normalizeName(change.item);
  const now = new Date().toISOString();
  const existing: FridgeItem | null = must(
    await db.from("fridge_items").select("*").eq("item_key", key).maybeSingle(),
    "Load fridge item",
  );
  const inStock = change.action === "add";
  if (existing) {
    must(
      await db
        .from("fridge_items")
        .update({
          in_stock: inStock,
          quantity: inStock ? (change.quantity ?? existing.quantity) : "",
          last_confirmed_at: now,
          updated_at: now,
        })
        .eq("id", existing.id),
      "Update fridge item",
    );
  } else if (inStock) {
    must(
      await db.from("fridge_items").insert({
        item_key: key,
        display_name: change.item.trim().replace(/^\w/, (c) => c.toUpperCase()),
        quantity: change.quantity ?? "",
        in_stock: true,
      }),
      "Add fridge item",
    );
  }
  return key;
}

// Recipes ---------------------------------------------------------------------

export async function getRecipes(db: Db, keys: string[]): Promise<Recipe[]> {
  if (keys.length === 0) return [];
  return must(await db.from("recipes").select("*").in("dish_key", keys), "Load recipes");
}

export async function saveRecipes(db: Db, recipes: Recipe[]) {
  if (recipes.length === 0) return;
  must(await db.from("recipes").upsert(recipes), "Save recipes");
}

// Plans -----------------------------------------------------------------------

export async function getPlan(db: Db, date: string): Promise<MealPlan | null> {
  return must(
    await db.from("meal_plans").select("*").eq("plan_date", date).maybeSingle(),
    "Load plan",
  );
}

export async function getPlanById(db: Db, id: string): Promise<MealPlan | null> {
  return must(await db.from("meal_plans").select("*").eq("id", id).maybeSingle(), "Load plan");
}

/** Plans from the `days` days before `date` (not including it). */
export async function getRecentPlans(db: Db, date: string, days: number): Promise<MealPlan[]> {
  return must(
    await db
      .from("meal_plans")
      .select("*")
      .gte("plan_date", addDays(date, -days))
      .lt("plan_date", date)
      .order("plan_date", { ascending: false }),
    "Load recent plans",
  );
}

export async function listPlans(db: Db, limit = 30): Promise<MealPlan[]> {
  return must(
    await db.from("meal_plans").select("*").order("plan_date", { ascending: false }).limit(limit),
    "Load plans",
  );
}

export async function updatePlan(db: Db, id: string, patch: Partial<MealPlan>) {
  must(
    await db
      .from("meal_plans")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id),
    "Update plan",
  );
}

/** Creates the row for a date if needed and marks it `planning`. */
export async function startPlan(db: Db, date: string, mode: MealPlan["mode"]): Promise<MealPlan> {
  const existing = await getPlan(db, date);
  if (existing) {
    must(
      await db
        .from("meal_plans")
        .update({ status: "planning", mode, error: null, updated_at: new Date().toISOString() })
        .eq("id", existing.id),
      "Start plan",
    );
    return { ...existing, status: "planning", mode, error: null };
  }
  return must(
    await db
      .from("meal_plans")
      .insert({ plan_date: date, mode, status: "planning" })
      .select("*")
      .single(),
    "Create plan",
  );
}

export async function getVisitOverride(db: Db, date: string): Promise<VisitOverride | null> {
  return must(
    await db.from("visit_overrides").select("*").eq("plan_date", date).maybeSingle(),
    "Load visit override",
  );
}

export async function setVisitOverride(db: Db, override: VisitOverride) {
  must(await db.from("visit_overrides").upsert(override), "Save visit override");
}

export async function getFeedback(db: Db, limit = 30): Promise<PlanFeedback[]> {
  return must(
    await db
      .from("plan_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    "Load feedback",
  );
}

// Inputs and logs -------------------------------------------------------------

export async function listInputs(db: Db, limit = 50): Promise<UserInput[]> {
  return must(
    await db.from("user_inputs").select("*").order("created_at", { ascending: false }).limit(limit),
    "Load inputs",
  );
}

export async function listLlmLogs(db: Db, limit = 100): Promise<LlmLog[]> {
  return must(
    await db.from("llm_logs").select("*").order("created_at", { ascending: false }).limit(limit),
    "Load logs",
  );
}
