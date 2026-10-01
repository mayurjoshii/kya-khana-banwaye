import { NextResponse } from "next/server";

import { AUDIO_BUCKET } from "@/lib/audio";
import { getPlanById } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Streams a plan's mp3 from private storage to the signed-in owner. */
export async function GET(_request: Request, ctx: RouteContext<"/api/plans/[id]/audio">) {
  const { id } = await ctx.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const plan = await getPlanById(db, id);
  if (!plan?.audio_path) return NextResponse.json({ error: "No audio for this plan yet" }, { status: 404 });

  const { data, error } = await db.storage.from(AUDIO_BUCKET).download(plan.audio_path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Audio not found" }, { status: 404 });

  return new NextResponse(data, {
    headers: {
      "content-type": "audio/mpeg",
      "content-disposition": `inline; filename="cook-${plan.plan_date}.mp3"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
