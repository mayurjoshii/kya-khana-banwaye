// Read-only plan rendering, shared by Today and History.

import { Chip } from "@/components/ui";
import { MEAL_LABEL, MEALS_FOR_MODE, type MealPlan, type PlanStatus } from "@/lib/types";

export const STATUS_LABEL: Record<PlanStatus, string> = {
  planning: "Planning",
  planned: "Planned",
  audio_ready: "Audio ready",
  sent: "Sent",
  failed: "Failed",
  stale: "Needs a new plan",
};

const STATUS_TONE: Record<PlanStatus, "haldi" | "kothimbir" | "mirchi" | "neel" | "plain"> = {
  planning: "haldi",
  planned: "haldi",
  audio_ready: "neel",
  sent: "kothimbir",
  failed: "mirchi",
  stale: "mirchi",
};

export function StatusChip({ status }: { status: PlanStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}

export function MenuByMeal({
  plan,
  mealProteinMin,
  animate = false,
  showSteps = true,
}: {
  plan: Pick<MealPlan, "mode" | "dishes" | "protein">;
  mealProteinMin: number;
  animate?: boolean;
  showSteps?: boolean;
}) {
  let index = 0;
  return (
    <div className="flex flex-col gap-6">
      {MEALS_FOR_MODE[plan.mode].map((meal) => {
        const dishes = plan.dishes.filter((d) => d.meals.includes(meal));
        const protein = plan.protein[meal];
        return (
          <section key={meal}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-heading">{MEAL_LABEL[meal]}</h3>
              {protein !== undefined && (
                <Chip tone={protein >= mealProteinMin ? "kothimbir" : "mirchi"}>
                  {protein} g protein each{protein < mealProteinMin ? " · low" : ""}
                </Chip>
              )}
            </div>
            {dishes.length === 0 ? (
              <p className="text-small text-ink-muted">Nothing planned.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dishes.map((dish) => (
                  <li
                    key={dish.key}
                    className={`rounded-sm bg-paper p-4 ${animate ? "drop-in" : ""}`}
                    style={animate ? { animationDelay: `${index++ * 90}ms` } : undefined}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">{dish.name}</span>
                      <span className="text-small text-ink-muted">
                        {dish.complexity} · {dish.minutes} min
                        {dish.meals.length > 1 ? " · lunch and dinner" : ""}
                      </span>
                    </div>
                    <p lang="hi" className="text-hindi">
                      {dish.name_hi}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dish.cook_knows ? <Chip tone="kothimbir">Cook knows it</Chip> : <Chip>Steps included</Chip>}
                    </div>
                    {showSteps && !dish.cook_knows && dish.steps_hi.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-small font-bold">Steps for the cook</summary>
                        <ol lang="hi" className="mt-2 list-decimal pl-6 text-hindi">
                          {dish.steps_hi.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </details>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-small text-ink-muted">Ingredients</summary>
                      <p className="mt-1 text-small">
                        {dish.ingredients.map((i) => `${i.item} ${i.quantity} ${i.unit}`).join(", ")}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
