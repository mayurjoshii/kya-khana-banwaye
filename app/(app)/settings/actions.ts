"use server";

import { revalidatePath } from "next/cache";

import { addPreference } from "@/lib/data";
import { normalizeName } from "@/lib/normalize";
import { requireOwner } from "@/lib/supabase/server";
import { endOfIstDay, istDate, addDays } from "@/lib/time";
import type { PreferenceKind, RuleKind, VisitMode } from "@/lib/types";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const int = (form: FormData, key: string, fallback: number) => {
  const n = Number.parseInt(text(form, key), 10);
  return Number.isFinite(n) ? n : fallback;
};

async function check(result: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await result;
  if (error) throw new Error(error.message);
}

export async function savePerson(form: FormData) {
  const db = await requireOwner();
  await check(
    db
      .from("people")
      .update({
        name: text(form, "name") || "Me",
        protein_min_g: int(form, "protein_min_g", 60),
        protein_max_g: int(form, "protein_max_g", 70),
        meal_protein_min_g: int(form, "meal_protein_min_g", 25),
        meal_protein_max_g: int(form, "meal_protein_max_g", 30),
        notes: text(form, "notes"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", text(form, "id")),
  );
  revalidatePath("/settings");
}

export async function saveCookProfile(form: FormData) {
  const db = await requireOwner();
  await check(
    db
      .from("cook_profile")
      .update({
        name: text(form, "name") || "Cook",
        visit_time: text(form, "visit_time") || "12:30",
        visit_minutes: int(form, "visit_minutes", 60),
        max_dishes_simple: int(form, "max_dishes_simple", 4),
        max_dishes_complex: int(form, "max_dishes_complex", 3),
        servings: int(form, "servings", 2),
        language: text(form, "language") || "hi-IN",
        default_mode: (text(form, "default_mode") || "lunch_dinner") as VisitMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1),
  );
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addRule(form: FormData) {
  const db = await requireOwner();
  const rule = text(form, "rule");
  if (!rule) return;
  await check(db.from("cook_rules").insert({ rule, kind: (text(form, "kind") || "soft") as RuleKind }));
  revalidatePath("/settings");
}

export async function toggleRule(form: FormData) {
  const db = await requireOwner();
  await check(
    db.from("cook_rules").update({ active: text(form, "active") !== "true" }).eq("id", text(form, "id")),
  );
  revalidatePath("/settings");
}

export async function deleteRule(form: FormData) {
  const db = await requireOwner();
  await check(db.from("cook_rules").delete().eq("id", text(form, "id")));
  revalidatePath("/settings");
}

export async function addSkill(form: FormData) {
  const db = await requireOwner();
  const name = text(form, "display_name");
  if (!name) return;
  await check(
    db.from("cook_skills").upsert({
      dish_key: normalizeName(name),
      display_name: name,
      knows: text(form, "knows") !== "false",
      updated_at: new Date().toISOString(),
    }),
  );
  revalidatePath("/settings");
}

export async function toggleSkill(form: FormData) {
  const db = await requireOwner();
  await check(
    db
      .from("cook_skills")
      .update({ knows: text(form, "knows") !== "true", updated_at: new Date().toISOString() })
      .eq("dish_key", text(form, "dish_key")),
  );
  revalidatePath("/settings");
}

export async function deleteSkill(form: FormData) {
  const db = await requireOwner();
  await check(db.from("cook_skills").delete().eq("dish_key", text(form, "dish_key")));
  revalidatePath("/settings");
}

export async function addPreferenceAction(form: FormData) {
  const db = await requireOwner();
  const item = text(form, "item");
  if (!item) return;
  const expiry = text(form, "expiry");
  const today = istDate();
  const expires_at =
    expiry === "today"
      ? endOfIstDay(today).toISOString()
      : expiry === "tomorrow"
        ? endOfIstDay(addDays(today, 1)).toISOString()
        : expiry === "week"
          ? endOfIstDay(addDays(today, 7)).toISOString()
          : null;
  await addPreference(db, {
    kind: (text(form, "kind") || "like") as PreferenceKind,
    item,
    person_id: text(form, "person_id") || null,
    strength: int(form, "strength", 2),
    expires_at,
  });
  revalidatePath("/settings");
}

export async function deletePreference(form: FormData) {
  const db = await requireOwner();
  await check(db.from("preferences").update({ active: false }).eq("id", text(form, "id")));
  revalidatePath("/settings");
}
