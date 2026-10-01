import { NextResponse } from "next/server";

import { makeVoiceNote } from "@/lib/audio";
import { checkCronAuth } from "@/lib/cron";
import { getPlan } from "@/lib/data";
import { runPlan } from "@/lib/planner/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, istDate } from "@/lib/time";

export const maxDuration = 300;

/**
 * Nightly, ~20:30 IST: plan tomorrow's visit, make the voice note and send both
 * to Telegram. A plan made by hand earlier in the evening is kept. Also keeps
 * the Supabase project awake.
 */
export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const db = createAdminClient();
  const date = addDays(istDate(), 1);
  const existing = await getPlan(db, date);
  const keep = existing && ["planned", "audio_ready", "sent"].includes(existing.status);

  let plan = keep ? existing : await runPlan(db, date);
  if (plan.status === "planned" && !plan.audio_path) {
    // Sends the mp3 (or the text, if the voice fails) with the plan summary.
    plan = await makeVoiceNote(db, plan.id, { notify: true });
  }
  return NextResponse.json({ date, status: plan.status, planned: !keep, error: plan.error });
}
