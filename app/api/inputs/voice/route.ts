import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { configured } from "@/lib/env";
import { processInput } from "@/lib/inputs";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const MAX_BYTES = 6 * 1024 * 1024; // ~3 minutes of 16 kHz mono WAV

/** Receives a recorded voice note (WAV), transcribes it and applies it. */
export async function POST(request: Request) {
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ ok: false, lines: ["Sign in first."] }, { status: 401 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ ok: false, lines: ["No recording received. Try again."] }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, lines: ["That recording is too long. Keep it under 2 minutes."] }, { status: 413 });
  }
  if (!configured.gemini) {
    return NextResponse.json(
      { ok: false, lines: ["Voice notes need GEMINI_API_KEY. Type the note for now."] },
      { status: 503 },
    );
  }

  const { data: row, error } = await db.from("user_inputs").insert({ text: "", source: "voice" }).select("id").single();
  if (error) return NextResponse.json({ ok: false, lines: [`Couldn't save: ${error.message}`] }, { status: 500 });

  try {
    const bytes = Buffer.from(await audio.arrayBuffer());
    const result = await processInput(db, row.id, {
      audio: { data: bytes.toString("base64"), mimeType: audio.type || "audio/wav" },
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, lines: [`Heard: "${result.transcript}"`, ...result.applied] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, lines: [`Couldn't read the recording: ${message}`, "Record it again or type it."] },
      { status: 502 },
    );
  }
}
