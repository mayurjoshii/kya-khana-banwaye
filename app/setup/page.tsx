import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Card } from "@/components/ui";
import { configured } from "@/lib/env";

export const metadata = { title: "Set up · Cook Assistant" };

export default async function SetupPage() {
  await connection();
  if (configured.supabase) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-title">Almost there</h1>
      <p className="mt-2 mb-6 text-body text-ink-muted">
        The app needs a Supabase project before you can sign in.
      </p>
      <Card>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-body">
          <li>Create a free project at supabase.com.</li>
          <li>
            In the SQL editor, run <code>supabase/migrations/20261002000000_init.sql</code>, then{" "}
            <code>supabase/seed.sql</code>.
          </li>
          <li>Authentication → Sign In / Providers: turn off &ldquo;Allow new users to sign up&rdquo;.</li>
          <li>Authentication → Users: add your user with email and password.</li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in the Supabase URL and
            keys, then restart <code>pnpm dev</code>.
          </li>
        </ol>
      </Card>
      <p className="mt-6 text-small text-ink-muted">The full checklist is in README.md.</p>
    </main>
  );
}
