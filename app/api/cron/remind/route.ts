import { NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron";
import { getCookProfile, getPlan } from "@/lib/data";
import { appLink, escapeHtml, sendMessage } from "@/lib/notify/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDate } from "@/lib/time";

/** Around noon IST: make sure today's voice note reaches the cook. */
export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const db = createAdminClient();
  const date = istDate();
  const [plan, cook] = await Promise.all([getPlan(db, date), getCookProfile(db)]);
  const at = cook.visit_time.slice(0, 5);
  const name = escapeHtml(cook.name);
  const open = [{ text: "Open today's plan", url: appLink("/") }];

  let message: string | null = null;
  if (!plan || plan.dishes.length === 0) {
    message = `<b>No plan for today</b>\n${name} comes at ${at}. Plan now in the app, or send her a quick text menu.`;
  } else if (plan.status === "audio_ready") {
    message = `<b>Voice note not sent yet</b>\n${name} comes at ${at}. Open the app and tap Send to cook.`;
  } else if (plan.status === "planned") {
    message = `<b>Today's plan has no voice note yet</b>\nOpen the app to make it, or send her the text plan.`;
  } else if (plan.status === "failed" || plan.status === "stale" || plan.status === "planning") {
    message = `<b>Today's plan needs attention</b>\n${escapeHtml(plan.error ?? "It didn't finish.")}\n${name} comes at ${at}.`;
  }

  const sent = message ? await sendMessage(message, open) : false;
  return NextResponse.json({ date, status: plan?.status ?? "none", reminded: Boolean(message), delivered: sent });
}
