import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addPreference, applyFridgeChange, getCookProfile, getFridge, getPeople, setVisitOverride } from "@/lib/data";
import { callJson } from "@/lib/llm/gemini";
import { EXTRACTION_SYSTEM, extractionPrompt } from "@/lib/llm/prompts";
import { ExtractionSchema, type Extraction } from "@/lib/llm/schemas";
import { normalizeName } from "@/lib/normalize";
import { afterFridgeChange, markUpcomingPlanStale } from "@/lib/plans";
import { addDays, endOfIstDay, istDate, upcomingVisitDate } from "@/lib/time";
import type { Person } from "@/lib/types";

export interface ProcessResult {
  applied: string[];
  transcript: string;
}

/**
 * Reads one note (text or audio) with Gemini and applies it to the tables.
 * The input row records the result or the error.
 */
export async function processInput(
  db: SupabaseClient,
  inputId: string,
  source: { text?: string; audio?: { data: string; mimeType: string } },
): Promise<ProcessResult> {
  try {
    const [people, fridge] = await Promise.all([getPeople(db), getFridge(db)]);
    const names = {
      me: people.find((p) => p.role === "me")?.name ?? "Me",
      partner: people.find((p) => p.role === "partner")?.name ?? "Partner",
    };
    const extraction = await callJson({
      db,
      purpose: "extract",
      schema: ExtractionSchema,
      system: EXTRACTION_SYSTEM,
      prompt: extractionPrompt({
        today: istDate(),
        names,
        knownItems: fridge.map((f) => f.display_name.toLowerCase()),
        text: source.text,
      }),
      audio: source.audio,
    });
    const applied = await applyExtraction(db, extraction, inputId, people);
    const transcript = source.text ?? extraction.transcript;
    const { error } = await db
      .from("user_inputs")
      .update({
        text: transcript,
        processed_at: new Date().toISOString(),
        extraction: { result: extraction, applied },
        error: null,
      })
      .eq("id", inputId);
    if (error) throw new Error(error.message);
    return { applied, transcript };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("user_inputs").update({ error: message }).eq("id", inputId);
    throw err;
  }
}

function expiryFor(expiry: Extraction["preferences"][number]["expiry"]): string | null {
  const today = istDate();
  if (expiry === "today") return endOfIstDay(today).toISOString();
  if (expiry === "tomorrow") return endOfIstDay(addDays(today, 1)).toISOString();
  if (expiry === "week") return endOfIstDay(addDays(today, 7)).toISOString();
  return null;
}

/** Applies an extraction. Returns one plain line per change, for the UI. */
export async function applyExtraction(
  db: SupabaseClient,
  x: Extraction,
  inputId: string | null,
  people: Person[],
): Promise<string[]> {
  const applied: string[] = [];
  const personId = (who: "me" | "partner" | "both") =>
    who === "both" ? null : (people.find((p) => p.role === who)?.id ?? null);
  const personLabel = (who: "me" | "partner" | "both") =>
    who === "both" ? "both" : (people.find((p) => p.role === who)?.name ?? who);

  for (const pref of x.preferences) {
    await addPreference(db, {
      kind: pref.kind,
      item: pref.item,
      person_id: personId(pref.person),
      strength: pref.strength,
      expires_at: expiryFor(pref.expiry),
      source_input_id: inputId,
    });
    const until = pref.expiry === "permanent" ? "" : ` (${pref.expiry === "week" ? "this week" : pref.expiry})`;
    applied.push(`${pref.kind[0].toUpperCase()}${pref.kind.slice(1)}: ${pref.item} for ${personLabel(pref.person)}${until}`);
  }

  const fridgeKeys: string[] = [];
  for (const change of x.fridge) {
    fridgeKeys.push(await applyFridgeChange(db, change));
    const verb = change.action === "add" ? "Fridge: added" : "Fridge: out of";
    applied.push(`${verb} ${change.item}${change.quantity && change.action === "add" ? ` (${change.quantity})` : ""}`);
  }

  for (const goal of x.goal_changes) {
    const targets = goal.person === "both" ? people : people.filter((p) => p.role === goal.person);
    for (const p of targets) {
      const patch: Record<string, number> = {};
      if (goal.protein_min_g) patch.protein_min_g = goal.protein_min_g;
      if (goal.protein_max_g) patch.protein_max_g = goal.protein_max_g;
      if (Object.keys(patch).length === 0) continue;
      await db.from("people").update(patch).eq("id", p.id);
      applied.push(`Protein goal for ${p.name}: ${goal.protein_min_g ?? p.protein_min_g}–${goal.protein_max_g ?? p.protein_max_g} g`);
    }
  }

  for (const rule of x.cook_rules) {
    await db.from("cook_rules").insert({ rule: rule.rule, kind: rule.kind });
    applied.push(`Cook rule (${rule.kind}): ${rule.rule}`);
  }

  for (const skill of x.cook_skills) {
    await db.from("cook_skills").upsert({
      dish_key: normalizeName(skill.dish),
      display_name: skill.dish,
      knows: skill.knows,
      updated_at: new Date().toISOString(),
    });
    applied.push(`Cook ${skill.knows ? "knows" : "needs steps for"} ${skill.dish}`);
  }

  if (x.mode_for_next_visit) {
    const cook = await getCookProfile(db);
    const date = upcomingVisitDate(cook.visit_time, cook.visit_minutes);
    await setVisitOverride(db, { plan_date: date, mode: x.mode_for_next_visit, note: "" });
    await markUpcomingPlanStale(db, date, "The visit changed. Regenerate the plan.");
    applied.push(`Next visit: ${x.mode_for_next_visit === "lunch_snacks" ? "lunch + snacks" : "lunch + dinner"}`);
  }

  // Preferences can make the upcoming plan wrong too (e.g. "no eggs tomorrow").
  if (x.preferences.some((p) => p.kind === "avoid" || p.kind === "dislike")) {
    const cook = await getCookProfile(db);
    await markUpcomingPlanStale(
      db,
      upcomingVisitDate(cook.visit_time, cook.visit_minutes),
      "A new dislike or avoid may clash with this plan.",
      x.preferences.filter((p) => p.kind === "avoid" || p.kind === "dislike").map((p) => normalizeName(p.item)),
    );
  }

  if (fridgeKeys.length > 0) await afterFridgeChange(db);
  if (x.unhandled.trim()) applied.push(`Not used: ${x.unhandled.trim()}`);
  if (applied.length === 0) applied.push("Nothing to change.");
  return applied;
}
