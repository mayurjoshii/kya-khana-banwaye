import { MenuByMeal, StatusChip } from "@/components/plan-view";
import { SubmitButton } from "@/components/submit-button";
import { Chip, inputClass, labelClass, Muted, PageTitle } from "@/components/ui";
import { getFeedback, getPeople, listPlans } from "@/lib/data";
import { requireOwner } from "@/lib/supabase/server";
import { formatDay } from "@/lib/time";
import { MODE_LABEL, type MealPlan, type PlanFeedback } from "@/lib/types";

import { addFeedback } from "./actions";

export const metadata = { title: "History · Cook Assistant" };

export default async function HistoryPage() {
  const db = await requireOwner();
  const [plans, feedback, people] = await Promise.all([listPlans(db, 30), getFeedback(db, 100), getPeople(db)]);
  const mealProteinMin = people.length ? Math.max(...people.map((p) => p.meal_protein_min_g)) : 25;

  return (
    <>
      <PageTitle>History</PageTitle>
      <Muted className="mb-6">
        Rate each visit and note what the cook found hard. The planner reads recent feedback before every plan.
      </Muted>
      {plans.length === 0 ? (
        <Muted>Past plans show here once the first one is made.</Muted>
      ) : (
        <ul className="flex flex-col gap-4">
          {plans.map((plan) => (
            <PlanEntry
              key={plan.id}
              plan={plan}
              feedback={feedback.filter((f) => f.plan_id === plan.id)}
              mealProteinMin={mealProteinMin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function PlanEntry({
  plan,
  feedback,
  mealProteinMin,
}: {
  plan: MealPlan;
  feedback: PlanFeedback[];
  mealProteinMin: number;
}) {
  const names = [...new Set(plan.dishes.map((d) => d.name))].join(", ");
  return (
    <li className="rounded-lg border-2 border-line p-4">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{formatDay(plan.plan_date)}</span>
            <span className="flex gap-2">
              {feedback.some((f) => f.rating) && <Chip>{feedback.find((f) => f.rating)?.rating}/5</Chip>}
              <StatusChip status={plan.status} />
            </span>
          </div>
          <p className="mt-1 text-small text-ink-muted">{names || plan.error || "No dishes"}</p>
        </summary>

        <div className="mt-4 flex flex-col gap-6">
          {plan.dishes.length > 0 && (
            <div className="rounded-lg bg-paper-2 p-4">
              <Chip>{MODE_LABEL[plan.mode]}</Chip>
              <div className="mt-4">
                <MenuByMeal plan={plan} mealProteinMin={mealProteinMin} showSteps={false} />
              </div>
            </div>
          )}

          {feedback.length > 0 && (
            <ul className="flex flex-col gap-2 text-small">
              {feedback.map((f) => (
                <li key={f.id}>
                  {f.rating && <span className="font-bold">{f.rating}/5. </span>}
                  {f.cook_issue && <span>Cook: {f.cook_issue}. </span>}
                  {f.notes}
                </li>
              ))}
            </ul>
          )}

          <form action={addFeedback} className="flex flex-col gap-3">
            <input type="hidden" name="plan_id" value={plan.id} />
            <fieldset>
              <legend className={labelClass}>How was it?</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name="rating" value={n} className="peer sr-only" />
                    <span className="flex h-10 w-10 items-center justify-center rounded-pill border-2 border-ink font-bold peer-checked:bg-haldi peer-focus-visible:outline-3 peer-focus-visible:outline-neel">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor={`issue-${plan.id}`} className={labelClass}>
                Anything the cook found hard?
              </label>
              <input id={`issue-${plan.id}`} name="cook_issue" className={inputClass} placeholder="Steps for the gravy were unclear" />
            </div>
            <div>
              <label htmlFor={`notes-${plan.id}`} className={labelClass}>
                Notes
              </label>
              <input id={`notes-${plan.id}`} name="notes" className={inputClass} placeholder="Too much oil, loved the dal" />
            </div>
            <div>
              <SubmitButton pending="Saving…">Save feedback</SubmitButton>
            </div>
          </form>
        </div>
      </details>
    </li>
  );
}
