import { QuickInput } from "@/components/quick-input";
import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, Muted, PageTitle } from "@/components/ui";
import { listInputs } from "@/lib/data";
import { requireOwner } from "@/lib/supabase/server";
import { formatStamp } from "@/lib/time";

import { deleteInput, retryInput } from "./actions";

export const metadata = { title: "Inputs · Cook Assistant" };

function appliedLines(extraction: unknown): string[] {
  if (extraction && typeof extraction === "object" && "applied" in extraction) {
    const applied = (extraction as { applied: unknown }).applied;
    if (Array.isArray(applied)) return applied.map(String);
  }
  return [];
}

export default async function InputsPage() {
  const db = await requireOwner();
  const inputs = await listInputs(db);

  return (
    <>
      <PageTitle>Inputs</PageTitle>
      <Card className="mb-8">
        <QuickInput />
      </Card>

      {inputs.length === 0 ? (
        <Muted>Notes you send show here with what the app changed.</Muted>
      ) : (
        <ul className="flex flex-col gap-4">
          {inputs.map((input) => {
            const lines = appliedLines(input.extraction);
            const pending = !input.processed_at;
            return (
              <li key={input.id} className="rounded-lg border-2 border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Chip tone={input.source === "voice" ? "neel" : "plain"}>{input.source}</Chip>
                  {input.error ? (
                    <Chip tone="mirchi">Failed</Chip>
                  ) : pending ? (
                    <Chip tone="haldi">Not read yet</Chip>
                  ) : (
                    <Chip tone="kothimbir">Applied</Chip>
                  )}
                  <span className="text-small text-ink-muted">{formatStamp(input.created_at)}</span>
                </div>
                <p>{input.text || <span className="text-ink-muted">(recording not transcribed)</span>}</p>
                {lines.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-small text-ink-muted">
                    {lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
                {input.error && <p className="mt-2 text-small">Error: {input.error}</p>}
                <div className="mt-3 flex gap-3">
                  {pending && input.text && (
                    <form action={retryInput}>
                      <input type="hidden" name="id" value={input.id} />
                      <SubmitButton pending="Reading…">Retry</SubmitButton>
                    </form>
                  )}
                  <form action={deleteInput}>
                    <input type="hidden" name="id" value={input.id} />
                    <SubmitButton variant="quiet">Delete</SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
