"use server";

import { revalidatePath } from "next/cache";

import { getPlanById, setVisitOverride, updatePlan } from "@/lib/data";
import { runPlan } from "@/lib/planner/run";
import { requireOwner } from "@/lib/supabase/server";
import type { MissingDecision, VisitMode } from "@/lib/types";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Plan (or re-plan) the visit on `date`. Errors end up on the plan row. */
export async function planVisit(form: FormData) {
  const db = await requireOwner();
  await runPlan(db, text(form, "date"), { notify: false });
  revalidatePath("/");
}

/** Switch the visit between lunch + dinner and lunch + snacks, then re-plan. */
export async function switchMode(form: FormData) {
  const db = await requireOwner();
  const date = text(form, "date");
  const mode = text(form, "mode") as VisitMode;
  await setVisitOverride(db, { plan_date: date, mode, note: "" });
  await runPlan(db, date, { mode });
  revalidatePath("/");
}

/** Buy keeps the plan; Swap re-plans without that ingredient. */
export async function decideMissing(form: FormData) {
  const db = await requireOwner();
  const plan = await getPlanById(db, text(form, "plan_id"));
  if (!plan || plan.status === "sent") return;
  const key = text(form, "key");
  const decision = text(form, "decision") as MissingDecision;
  const missing = plan.missing_items.map((m) => (m.key === key ? { ...m, decision } : m));
  await updatePlan(db, plan.id, { missing_items: missing });
  if (decision === "swap") await runPlan(db, plan.plan_date);
  revalidatePath("/");
}
