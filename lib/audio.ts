import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCookProfile, getPlanById, updatePlan } from "@/lib/data";
import { callJson } from "@/lib/llm/gemini";
import { scriptPrompt, scriptSystem } from "@/lib/llm/prompts";
import { ScriptSchema } from "@/lib/llm/schemas";
import { appLink, escapeHtml, sendAudio, sendMessage } from "@/lib/notify/telegram";
import { planSummaryHtml } from "@/lib/planner/summary";
import { formatDay } from "@/lib/time";
import { speakToMp3 } from "@/lib/tts/speak";
import { MEAL_LABEL, MEALS_FOR_MODE, type MealPlan } from "@/lib/types";

export const AUDIO_BUCKET = "plan-audio";

export const audioFileName = (plan: Pick<MealPlan, "plan_date" | "version">) =>
  `${plan.plan_date}-v${plan.version}.mp3`;

/** Writes the cook's voice-note script for a plan (one Gemini call). */
async function writeScript(db: SupabaseClient, plan: MealPlan): Promise<string> {
  const cook = await getCookProfile(db);
  const result = await callJson({
    db,
    purpose: "script",
    schema: ScriptSchema,
    system: scriptSystem(cook.language),
    prompt: scriptPrompt({
      cookName: cook.name,
      servings: cook.servings,
      meals: MEALS_FOR_MODE[plan.mode].map((meal) => ({
        // Hindi meal names keep the script in one language.
        label: { lunch: "दोपहर का खाना", dinner: "रात का खाना", snack: "शाम का नाश्ता" }[meal] ?? MEAL_LABEL[meal],
        dishes: plan.dishes
          .filter((d) => d.meals.includes(meal))
          .map((d) => ({
            name_hi: d.name_hi || d.name,
            knows: d.cook_knows,
            steps: d.steps_hi,
            ingredients: d.ingredients.map((i) => `${i.item} ${i.quantity} ${i.unit}`).join(", "),
          })),
      })),
      boughtItems: plan.missing_items.filter((m) => m.decision === "buy").map((m) => m.item),
    }),
  });
  return result.script_hi.trim();
}

/**
 * Makes the voice note for a plan: script, then TTS, then mp3 in storage.
 * Ends `audio_ready`. If only the voice fails, the script is kept and sent as
 * text instead, and the plan stays `planned` with the error.
 */
export async function makeVoiceNote(db: SupabaseClient, planId: string, opts: { notify?: boolean } = {}): Promise<MealPlan> {
  const plan = await getPlanById(db, planId);
  if (!plan) throw new Error("Plan not found.");
  if (plan.dishes.length === 0) throw new Error("Plan the visit before making the voice note.");
  if (plan.status === "sent") throw new Error("This plan was already sent.");
  const day = formatDay(plan.plan_date);
  const links = [{ text: "Open the plan", url: appLink("/") }];

  let script = plan.script_hi ?? "";
  try {
    if (!script) {
      script = await writeScript(db, plan);
      await updatePlan(db, plan.id, { script_hi: script });
    }
  } catch (err) {
    const message = `Couldn't write the voice note: ${err instanceof Error ? err.message : String(err)}`;
    await updatePlan(db, plan.id, { error: message });
    if (opts.notify) {
      await sendMessage(`${planSummaryHtml(plan, day)}\n\n<b>Voice note failed</b>\n${escapeHtml(message)}`, links);
    }
    return { ...plan, error: message };
  }

  try {
    const cook = await getCookProfile(db);
    const mp3 = await speakToMp3(db, script, cook.language);
    const path = audioFileName(plan);
    const { error } = await db.storage.from(AUDIO_BUCKET).upload(path, mp3, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const patch: Partial<MealPlan> = { status: "audio_ready", audio_path: path, script_hi: script, error: null };
    await updatePlan(db, plan.id, patch);
    if (opts.notify) {
      await sendAudio(mp3, `Cook ${plan.plan_date}.mp3`, planSummaryHtml(plan, day), links);
    }
    return { ...plan, ...patch };
  } catch (err) {
    const message = `Voice failed: ${err instanceof Error ? err.message : String(err)}. The text is ready to send instead.`;
    await updatePlan(db, plan.id, { script_hi: script, error: message });
    if (opts.notify) {
      await sendMessage(
        `${planSummaryHtml(plan, day)}\n\n<b>Voice failed. Send her this text instead:</b>\n\n${escapeHtml(script)}`,
        links,
      );
    }
    return { ...plan, script_hi: script, error: message };
  }
}
