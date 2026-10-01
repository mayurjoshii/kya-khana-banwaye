"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/supabase/server";

export async function addFeedback(form: FormData) {
  const db = await requireOwner();
  const rating = Number.parseInt(String(form.get("rating") ?? ""), 10);
  const cookIssue = String(form.get("cook_issue") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();
  if (!rating && !cookIssue && !notes) return;
  await db.from("plan_feedback").insert({
    plan_id: String(form.get("plan_id") ?? ""),
    rating: rating >= 1 && rating <= 5 ? rating : null,
    cook_issue: cookIssue,
    notes,
  });
  revalidatePath("/history");
}
