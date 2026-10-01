import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { configured, env, NotConfiguredError } from "@/lib/env";

/** Supabase client acting as the signed-in owner (RLS applies). */
export async function createClient(): Promise<SupabaseClient> {
  if (!configured.supabase) throw new NotConfiguredError("NEXT_PUBLIC_SUPABASE_URL");
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabasePublishableKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * The signed-in client, or a redirect to /login. Use at the top of every
 * server action and signed-in page.
 */
export async function requireOwner(): Promise<SupabaseClient> {
  // Always render per request, even when env is missing at build time.
  await connection();
  if (!configured.supabase) redirect("/setup");
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return db;
}
