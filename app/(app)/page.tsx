import { MenuByMeal, StatusChip } from "@/components/plan-view";
import { QuickInput } from "@/components/quick-input";
import { CopyScript, SendToCook } from "@/components/send-to-cook";
import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, Muted, Notice, SectionHeading } from "@/components/ui";
import { getCookProfile, getPeople, getPlan } from "@/lib/data";
import { configured } from "@/lib/env";
import { requireOwner } from "@/lib/supabase/server";
import { formatDay, formatStamp, istDate, msSince, upcomingVisitDate } from "@/lib/time";
import { MODE_LABEL, type MealPlan, type VisitMode } from "@/lib/types";

import { decideMissing, makeVoiceNoteAction, planVisit, rewriteVoiceNote, switchMode } from "./actions";

const STUCK_MS = 5 * 60_000;

export default async function TodayPage() {
  const db = await requireOwner();
  const cook = await getCookProfile(db);
  const date = upcomingVisitDate(cook.visit_time, cook.visit_minutes);
  const [plan, people] = await Promise.all([getPlan(db, date), getPeople(db)]);
  const mealProteinMin = people.length ? Math.max(...people.map((p) => p.meal_protein_min_g)) : 25;
  const dayWord = date === istDate() ? "Today" : "Tomorrow";
  const stuck = plan?.status === "planning" && msSince(plan.updated_at) > STUCK_MS;
  const fresh = plan ? msSince(plan.updated_at) < 60_000 : false;
  const mode: VisitMode = plan?.mode ?? cook.default_mode;

  return (
    <>
      <header className="mb-6">
        <p className="text-label text-ink-muted">
          {formatDay(date)} · {cook.name} at {cook.visit_time.slice(0, 5)}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-title">{dayWord}</h1>
          {plan && <StatusChip status={stuck ? "failed" : plan.status} />}
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {!configured.gemini && (
          <Notice tone="haldi">Planning needs GEMINI_API_KEY. Add it to the environment, then plan the visit here.</Notice>
        )}

        {!plan || plan.dishes.length === 0 ? (
          <Card>
            {plan?.status === "planning" && !stuck ? (
              <p className="text-body">Planning the menu. This takes up to a minute.</p>
            ) : (
              <>
                <p className="text-heading">No plan yet for {dayWord.toLowerCase()}</p>
                <Muted className="mt-1 mb-4">
                  The nightly run plans tomorrow at about 20:30. You can plan now too.
                </Muted>
                {plan?.error && <ErrorNote plan={plan} />}
                <form action={planVisit}>
                  <input type="hidden" name="date" value={date} />
                  <SubmitButton variant="primary" pending="Planning… up to a minute" className="py-3">
                    Plan {dayWord.toLowerCase()}
                  </SubmitButton>
                </form>
              </>
            )}
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <Chip>{MODE_LABEL[plan.mode]}</Chip>
                <span className="text-small text-ink-muted">Planned {formatStamp(plan.updated_at)}</span>
              </div>
              {(plan.status === "failed" || plan.status === "stale" || stuck) && <ErrorNote plan={plan} stuck={stuck} />}
              <MenuByMeal plan={plan} mealProteinMin={mealProteinMin} animate={fresh} />
              {plan.warnings.length > 0 && (
                <ul className="mt-6 flex flex-col gap-1 text-small">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-bold">Heads up:</span> {w}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <MissingItems plan={plan} />

            <VoiceNote plan={plan} cookName={cook.name} />

            {plan.status !== "sent" && (
              <section className="flex flex-wrap gap-3">
                <form action={planVisit}>
                  <input type="hidden" name="date" value={date} />
                  <SubmitButton pending="Planning… up to a minute">
                    {plan.status === "stale" || plan.status === "failed" ? "Make a new plan" : "Regenerate"}
                  </SubmitButton>
                </form>
                <form action={switchMode}>
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="mode" value={mode === "lunch_dinner" ? "lunch_snacks" : "lunch_dinner"} />
                  <SubmitButton pending="Re-planning…">
                    Switch to {MODE_LABEL[mode === "lunch_dinner" ? "lunch_snacks" : "lunch_dinner"].toLowerCase()}
                  </SubmitButton>
                </form>
              </section>
            )}
          </>
        )}

        <section>
          <SectionHeading>Tell the app</SectionHeading>
          <Card>
            <QuickInput />
          </Card>
        </section>
      </div>
    </>
  );
}

function ErrorNote({ plan, stuck = false }: { plan: MealPlan; stuck?: boolean }) {
  const message = stuck ? "Planning stopped before it finished. Try again." : plan.error;
  if (!message) return null;
  return (
    <div className="mb-4">
      <Notice tone="mirchi">{message}</Notice>
    </div>
  );
}

function MissingItems({ plan }: { plan: MealPlan }) {
  const items = plan.missing_items.filter((m) => m.decision !== "swap");
  if (items.length === 0) return null;
  const locked = plan.status === "sent";
  return (
    <section>
      <SectionHeading>Not in the fridge</SectionHeading>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-line p-4">
            <span>
              <span className="font-bold">{item.item}</span>
              {item.quantity && <span> · {item.quantity}</span>}
              <span className="block text-small text-ink-muted">For {item.dishes.join(", ")}</span>
            </span>
            {item.decision === "buy" ? (
              <Chip tone="kothimbir">Buying</Chip>
            ) : locked ? (
              <Chip tone="mirchi">Missing</Chip>
            ) : (
              <span className="flex items-center gap-2">
                <Chip tone="mirchi">Missing</Chip>
                <form action={decideMissing}>
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <input type="hidden" name="key" value={item.key} />
                  <input type="hidden" name="decision" value="buy" />
                  <SubmitButton>I&apos;ll buy it</SubmitButton>
                </form>
                <form action={decideMissing}>
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <input type="hidden" name="key" value={item.key} />
                  <input type="hidden" name="decision" value="swap" />
                  <SubmitButton pending="Swapping…">Swap dish</SubmitButton>
                </form>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VoiceNote({ plan, cookName }: { plan: MealPlan; cookName: string }) {
  if (plan.status === "stale" || plan.status === "failed" || plan.status === "planning") return null;
  const player = plan.audio_path && (
    <audio controls preload="none" src={`/api/plans/${plan.id}/audio?v=${plan.version}`} className="w-full" />
  );
  const script = plan.script_hi && (
    <details className="mt-4">
      <summary className="cursor-pointer text-small font-bold">What the note says</summary>
      <p lang="hi" className="mt-2 whitespace-pre-line text-hindi">
        {plan.script_hi}
      </p>
    </details>
  );

  return (
    <section>
      <SectionHeading>Voice note for {cookName}</SectionHeading>
      <Card>
        {plan.status === "sent" ? (
          <>
            <p className="mb-4">
              <Chip tone="kothimbir">Sent</Chip>{" "}
              {plan.sent_at && <span className="text-small text-ink-muted">{formatStamp(plan.sent_at)}</span>}
            </p>
            {player}
            {script}
          </>
        ) : plan.status === "audio_ready" && plan.audio_path ? (
          <>
            {player}
            {script}
            <div className="mt-6">
              <SendToCook planId={plan.id} date={plan.plan_date} version={plan.version} />
            </div>
            <form action={rewriteVoiceNote} className="mt-4">
              <input type="hidden" name="plan_id" value={plan.id} />
              <SubmitButton variant="quiet" pending="Rewriting… up to a minute">
                Rewrite the note
              </SubmitButton>
            </form>
          </>
        ) : plan.script_hi && plan.error ? (
          <>
            <Notice tone="mirchi">{plan.error}</Notice>
            {script}
            <div className="mt-6 flex flex-col gap-4">
              <CopyScript planId={plan.id} script={plan.script_hi} />
              <form action={makeVoiceNoteAction}>
                <input type="hidden" name="plan_id" value={plan.id} />
                <SubmitButton pending="Trying again…">Try the voice again</SubmitButton>
              </form>
            </div>
          </>
        ) : (
          <>
            <Muted className="mb-4">
              Turns the plan into a short Hindi note with steps for new dishes. The nightly run makes it
              automatically.
            </Muted>
            {plan.error && (
              <div className="mb-4">
                <Notice tone="mirchi">{plan.error}</Notice>
              </div>
            )}
            <form action={makeVoiceNoteAction}>
              <input type="hidden" name="plan_id" value={plan.id} />
              <SubmitButton variant="primary" pending="Making the note… up to a minute" className="py-3">
                Make the voice note
              </SubmitButton>
            </form>
          </>
        )}
      </Card>
    </section>
  );
}
