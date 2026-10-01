"use server";

import { revalidatePath } from "next/cache";

import { applyFridgeChange } from "@/lib/data";
import { afterFridgeChange } from "@/lib/plans";
import { requireOwner } from "@/lib/supabase/server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/fridge");
  revalidatePath("/");
}

export async function addItem(form: FormData) {
  const db = await requireOwner();
  const item = text(form, "item");
  if (!item) return;
  const key = await applyFridgeChange(db, { item, quantity: text(form, "quantity"), action: "add" });
  if (form.get("is_staple") === "on") {
    await db.from("fridge_items").update({ is_staple: true }).eq("item_key", key);
  }
  await afterFridgeChange(db);
  refresh();
}

export async function setInStock(form: FormData) {
  const db = await requireOwner();
  const now = new Date().toISOString();
  const inStock = text(form, "in_stock") === "true";
  await db
    .from("fridge_items")
    .update({ in_stock: inStock, last_confirmed_at: now, updated_at: now, ...(inStock ? {} : { quantity: "" }) })
    .eq("id", text(form, "id"));
  await afterFridgeChange(db);
  refresh();
}

export async function confirmItem(form: FormData) {
  const db = await requireOwner();
  await db.from("fridge_items").update({ last_confirmed_at: new Date().toISOString() }).eq("id", text(form, "id"));
  refresh();
}

export async function deleteItem(form: FormData) {
  const db = await requireOwner();
  await db.from("fridge_items").delete().eq("id", text(form, "id"));
  await afterFridgeChange(db);
  refresh();
}
