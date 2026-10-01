import "server-only";

import { NextResponse } from "next/server";

import { configured, env } from "@/lib/env";

/** Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron routes. */
export function checkCronAuth(request: Request): NextResponse | null {
  if (!configured.cron) {
    return NextResponse.json({ error: "Not configured: add CRON_SECRET" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!configured.supabaseAdmin) {
    return NextResponse.json({ error: "Not configured: add SUPABASE_SECRET_KEY" }, { status: 503 });
  }
  return null;
}
