import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { configured, env, NotConfiguredError } from "@/lib/env";

/** Service-role client for cron routes. Bypasses RLS: never use for user requests. */
export function createAdminClient(): SupabaseClient {
  if (!configured.supabaseAdmin) throw new NotConfiguredError("SUPABASE_SECRET_KEY");
  return createClient(env.supabaseUrl!, env.supabaseSecretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
