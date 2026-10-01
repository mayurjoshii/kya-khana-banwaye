"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return "Enter your email and password.";

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return "That email and password don't match. Try again.";
  redirect("/");
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
