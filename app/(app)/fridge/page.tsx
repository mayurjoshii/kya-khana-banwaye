import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, inputClass, labelClass, Muted, PageTitle, SectionHeading } from "@/components/ui";
import { getFridge } from "@/lib/data";
import { requireOwner } from "@/lib/supabase/server";
import { msSince } from "@/lib/time";
import type { FridgeItem } from "@/lib/types";

import { addItem, confirmItem, deleteItem, setInStock } from "./actions";

export const metadata = { title: "Fridge · Cook Assistant" };

const STALE_DAYS = 4;

function age(item: FridgeItem): { days: number; label: string } {
  const days = Math.floor(msSince(item.last_confirmed_at) / 86_400_000);
  return { days, label: days === 0 ? "checked today" : days === 1 ? "checked yesterday" : `checked ${days} days ago` };
}

export default async function FridgePage() {
  const db = await requireOwner();
  const items = await getFridge(db);
  const fresh = items.filter((i) => !i.is_staple && i.in_stock);
  const staples = items.filter((i) => i.is_staple);
  const out = items.filter((i) => !i.is_staple && !i.in_stock);

  return (
    <>
      <PageTitle>Fridge</PageTitle>

      <div className="flex flex-col gap-10">
        <Card>
          <form action={addItem} className="grid grid-cols-[1fr_8rem] gap-3">
            <div>
              <label htmlFor="item" className={labelClass}>
                Item
              </label>
              <input id="item" name="item" required className={inputClass} placeholder="Paneer" />
            </div>
            <div>
              <label htmlFor="quantity" className={labelClass}>
                How much
              </label>
              <input id="quantity" name="quantity" className={inputClass} placeholder="500 g" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-small">
              <input type="checkbox" name="is_staple" className="h-5 w-5 accent-ink" />
              Pantry staple (always there unless marked out)
            </label>
            <div className="col-span-2">
              <SubmitButton pending="Adding…">Add to fridge</SubmitButton>
            </div>
          </form>
          <Muted className="mt-3">Or say it on the Today screen: &ldquo;bought paneer and spinach&rdquo;.</Muted>
        </Card>

        <section>
          <SectionHeading>In the fridge</SectionHeading>
          {fresh.length === 0 ? (
            <Muted>Tell me what&apos;s in the fridge. Plans only use what&apos;s listed here and the staples.</Muted>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {fresh.map((item) => {
                const { days, label } = age(item);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="font-bold">{item.display_name}</span>
                      {item.quantity && <span> · {item.quantity}</span>}
                      <span className="block text-small text-ink-muted">
                        {label}
                        {days >= STALE_DAYS && " · still there?"}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2">
                      {days >= STALE_DAYS && (
                        <form action={confirmItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <SubmitButton variant="quiet">Still there</SubmitButton>
                        </form>
                      )}
                      <form action={setInStock}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="in_stock" value="false" />
                        <SubmitButton pending="…">Used up</SubmitButton>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading>Pantry staples</SectionHeading>
          <Muted className="mb-3">Counted as there until you mark one out. They never trigger a missing-item alert.</Muted>
          <ul className="flex flex-wrap gap-2">
            {staples.map((item) => (
              <li key={item.id}>
                <form action={setInStock}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="in_stock" value={String(!item.in_stock)} />
                  <button
                    type="submit"
                    aria-pressed={item.in_stock}
                    title={item.in_stock ? "Tap to mark as out" : "Tap to mark as back"}
                    className={`rounded-pill border-2 border-ink px-3 py-1 text-small font-bold ${
                      item.in_stock ? "bg-paper" : "bg-mirchi"
                    }`}
                  >
                    {item.display_name}
                    {!item.in_stock && " · out"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        {out.length > 0 && (
          <section>
            <SectionHeading>Used up</SectionHeading>
            <ul className="flex flex-col divide-y divide-line">
              {out.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    {item.display_name}
                    <Chip>out</Chip>
                  </span>
                  <span className="flex gap-2">
                    <form action={setInStock}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="in_stock" value="true" />
                      <SubmitButton variant="quiet">Back in stock</SubmitButton>
                    </form>
                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton variant="quiet">Forget</SubmitButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
