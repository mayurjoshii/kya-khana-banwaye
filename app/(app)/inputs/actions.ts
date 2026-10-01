"use server";

import { revalidatePath } from "next/cache";

import { configured } from "@/lib/env";
import { processInput } from "@/lib/inputs";
import { requireOwner } from "@/lib/supabase/server";

export interface InputResult {
  ok: boolean;
  lines: string[];
}

export async function addTextInput(_prev: InputResult | null, form: FormData): Promise<InputResult> {
  const db = await requireOwner();
  const text = String(form.get("text") ?? "").trim();
  if (!text) return { ok: false, lines: ["Type something first."] };

  const { data, error } = await db.from("user_inputs").insert({ text, source: "text" }).select("id").single();
  if (error) return { ok: false, lines: [`Couldn't save the note: ${error.message}`] };

  if (!configured.gemini) {
    revalidatePath("/inputs");
    return { ok: true, lines: ["Saved. It will be read once GEMINI_API_KEY is set (retry it on the Inputs screen)."] };
  }
  try {
    const result = await processInput(db, data.id, { text });
    revalidatePath("/", "layout");
    return { ok: true, lines: result.applied };
  } catch (err) {
    revalidatePath("/inputs");
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, lines: [`Saved, but couldn't read it: ${message}`, "Retry it on the Inputs screen."] };
  }
}

export async function retryInput(form: FormData) {
  const db = await requireOwner();
  const id = String(form.get("id") ?? "");
  const { data } = await db.from("user_inputs").select("text").eq("id", id).single();
  if (!data?.text) return;
  try {
    await processInput(db, id, { text: data.text });
  } catch {
    // The error is saved on the input row and shown on the Inputs screen.
  }
  revalidatePath("/", "layout");
}

export async function deleteInput(form: FormData) {
  const db = await requireOwner();
  await db.from("user_inputs").delete().eq("id", String(form.get("id") ?? ""));
  revalidatePath("/inputs");
}
