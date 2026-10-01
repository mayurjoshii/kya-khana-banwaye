import Link from "next/link";

import { Chip, Muted, PageTitle } from "@/components/ui";
import { listLlmLogs } from "@/lib/data";
import { requireOwner } from "@/lib/supabase/server";
import { formatStamp, istDate } from "@/lib/time";
import type { LlmLog } from "@/lib/types";

export const metadata = { title: "AI logs · Cook Assistant" };

const STATUS_TONE: Record<LlmLog["status"], "kothimbir" | "haldi" | "mirchi"> = {
  ok: "kothimbir",
  invalid: "haldi",
  error: "mirchi",
};

export default async function LogsPage() {
  const db = await requireOwner();
  const logs = await listLlmLogs(db, 100);
  const todayIst = istDate();
  const today = logs.filter((l) => istDate(new Date(l.created_at)) === todayIst);

  return (
    <>
      <PageTitle aside={<Link href="/settings" className="font-bold underline underline-offset-4">Settings</Link>}>
        AI logs
      </PageTitle>
      <Muted className="mb-6">
        The last 100 Gemini calls. {today.length} today, {logs.filter((l) => l.status !== "ok").length} not ok in
        this list.
      </Muted>
      {logs.length === 0 ? (
        <Muted>No calls yet. They show here once the app reads a note or plans a visit.</Muted>
      ) : (
        <ul className="flex flex-col gap-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-sm border-2 border-line p-3">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={STATUS_TONE[log.status]}>{log.status}</Chip>
                    <span className="font-bold">{log.purpose}</span>
                    <span className="text-small text-ink-muted">
                      {formatStamp(log.created_at)}
                      {log.latency_ms != null && ` · ${(log.latency_ms / 1000).toFixed(1)} s`}
                      {log.input_tokens != null && ` · ${log.input_tokens} in / ${log.output_tokens ?? 0} out`}
                    </span>
                  </div>
                  {log.error && <p className="mt-1 text-small">{log.error}</p>}
                </summary>
                <div className="mt-3 flex flex-col gap-3 text-small">
                  <p className="text-ink-muted">{log.model}</p>
                  <div>
                    <p className="text-label">Prompt</p>
                    <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-sm bg-paper-2 p-3">{log.prompt}</pre>
                  </div>
                  {log.response && (
                    <div>
                      <p className="text-label">Response</p>
                      <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-sm bg-paper-2 p-3">{log.response}</pre>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
