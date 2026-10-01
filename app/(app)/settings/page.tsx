import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, inputClass, labelClass, Muted, PageTitle, SectionHeading } from "@/components/ui";
import { signOut } from "@/app/login/actions";
import {
  getActivePreferences,
  getCookProfile,
  getCookRules,
  getCookSkills,
  getPeople,
} from "@/lib/data";
import { configured } from "@/lib/env";
import { requireOwner } from "@/lib/supabase/server";
import { formatStamp } from "@/lib/time";
import { MODE_LABEL, type Person, type PreferenceKind } from "@/lib/types";

import {
  addPreferenceAction,
  addRule,
  addSkill,
  deletePreference,
  deleteRule,
  deleteSkill,
  saveCookProfile,
  savePerson,
  toggleRule,
  toggleSkill,
} from "./actions";

export const metadata = { title: "Settings · Cook Assistant" };

const KIND_TONE: Record<PreferenceKind, "kothimbir" | "mirchi" | "haldi" | "plain"> = {
  like: "kothimbir",
  craving: "haldi",
  dislike: "mirchi",
  avoid: "mirchi",
  note: "plain",
};

export default async function SettingsPage() {
  const db = await requireOwner();
  const [people, cook, rules, skills, prefs] = await Promise.all([
    getPeople(db),
    getCookProfile(db),
    getCookRules(db),
    getCookSkills(db),
    getActivePreferences(db),
  ]);
  const personName = (id: string | null) =>
    id ? (people.find((p) => p.id === id)?.name ?? "Unknown") : "Both";

  return (
    <>
      <PageTitle>Settings</PageTitle>

      <div className="flex flex-col gap-10">
        <section>
          <SectionHeading>People</SectionHeading>
          <div className="flex flex-col gap-4">
            {people.map((person) => (
              <PersonForm key={person.id} person={person} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading>Tastes</SectionHeading>
          <Card>
            {prefs.length === 0 ? (
              <Muted>No likes or dislikes yet. Add some below or tell the app on the Today screen.</Muted>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {prefs.map((pref) => (
                  <li key={pref.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip tone={KIND_TONE[pref.kind]}>{pref.kind}</Chip>
                      <span>{pref.item}</span>
                      <span className="text-small text-ink-muted">
                        {personName(pref.person_id)}
                        {pref.expires_at ? ` · until ${formatStamp(pref.expires_at)}` : ""}
                      </span>
                    </span>
                    <form action={deletePreference}>
                      <input type="hidden" name="id" value={pref.id} />
                      <SubmitButton variant="quiet" pending="Removing…">
                        Remove
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addPreferenceAction} className="mt-6 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="pref-item" className={labelClass}>
                  Food or ingredient
                </label>
                <input id="pref-item" name="item" required className={inputClass} placeholder="Karela" />
              </div>
              <div>
                <label htmlFor="pref-kind" className={labelClass}>
                  Kind
                </label>
                <select id="pref-kind" name="kind" className={inputClass}>
                  <option value="like">Like</option>
                  <option value="dislike">Dislike</option>
                  <option value="craving">Craving</option>
                  <option value="avoid">Avoid</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div>
                <label htmlFor="pref-person" className={labelClass}>
                  For
                </label>
                <select id="pref-person" name="person_id" className={inputClass}>
                  <option value="">Both</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pref-expiry" className={labelClass}>
                  How long
                </label>
                <select id="pref-expiry" name="expiry" className={inputClass}>
                  <option value="permanent">Always</option>
                  <option value="today">Today</option>
                  <option value="tomorrow">Until tomorrow</option>
                  <option value="week">This week</option>
                </select>
              </div>
              <div>
                <label htmlFor="pref-strength" className={labelClass}>
                  Strength
                </label>
                <select id="pref-strength" name="strength" defaultValue="2" className={inputClass}>
                  <option value="1">Mild</option>
                  <option value="2">Normal</option>
                  <option value="3">Strong</option>
                </select>
              </div>
              <div className="col-span-2">
                <SubmitButton pending="Adding…">Add taste</SubmitButton>
              </div>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeading>Cook</SectionHeading>
          <Card>
            <form action={saveCookProfile} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="cook-name" className={labelClass}>
                  Name
                </label>
                <input id="cook-name" name="name" defaultValue={cook.name} className={inputClass} />
              </div>
              <NumberField id="visit_time" label="Arrives at" type="time" value={cook.visit_time.slice(0, 5)} />
              <NumberField id="visit_minutes" label="Stays (minutes)" value={cook.visit_minutes} />
              <NumberField id="max_dishes_complex" label="Max dishes, any complex" value={cook.max_dishes_complex} />
              <NumberField id="max_dishes_simple" label="Max dishes, all simple" value={cook.max_dishes_simple} />
              <NumberField id="servings" label="Servings" value={cook.servings} />
              <div>
                <label htmlFor="language" className={labelClass}>
                  Voice note language
                </label>
                <select id="language" name="language" defaultValue={cook.language} className={inputClass}>
                  <option value="hi-IN">Hindi</option>
                  <option value="mr-IN">Marathi</option>
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="default_mode" className={labelClass}>
                  Usual visit
                </label>
                <select id="default_mode" name="default_mode" defaultValue={cook.default_mode} className={inputClass}>
                  <option value="lunch_dinner">{MODE_LABEL.lunch_dinner}</option>
                  <option value="lunch_snacks">{MODE_LABEL.lunch_snacks}</option>
                </select>
              </div>
              <div className="col-span-2">
                <SubmitButton pending="Saving…">Save cook</SubmitButton>
              </div>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeading>Cook rules</SectionHeading>
          <Card>
            <ul className="flex flex-col divide-y divide-line">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-start justify-between gap-3 py-2">
                  <span className={rule.active ? "" : "text-ink-muted line-through"}>
                    <Chip tone={rule.kind === "hard" ? "haldi" : "plain"}>{rule.kind}</Chip>{" "}
                    {rule.rule}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="active" value={String(rule.active)} />
                      <SubmitButton variant="quiet">{rule.active ? "Pause" : "Use"}</SubmitButton>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <SubmitButton variant="quiet">Delete</SubmitButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
            <Muted className="mt-2">
              Hard rules go to the planner as must-follow. Diet, dish count and repeats are also checked in code.
            </Muted>
            <form action={addRule} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="rule" className="sr-only">
                New rule
              </label>
              <input id="rule" name="rule" required className={inputClass} placeholder="No deep frying on weekdays" />
              <select name="kind" aria-label="Rule kind" className={`${inputClass} sm:w-32`}>
                <option value="soft">Soft</option>
                <option value="hard">Hard</option>
              </select>
              <SubmitButton pending="Adding…">Add rule</SubmitButton>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeading>Dishes the cook knows</SectionHeading>
          <Card>
            {/* TODO(owner): replace the seed list with the 10–20 dishes she already makes well. */}
            <Muted className="mb-4">
              She gets Hindi steps only for dishes not marked as known. A dish she cooks twice from steps is marked
              known automatically.
            </Muted>
            <ul className="flex flex-col divide-y divide-line">
              {skills.map((skill) => (
                <li key={skill.dish_key} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    {skill.display_name}
                    <Chip tone={skill.knows ? "kothimbir" : "plain"}>{skill.knows ? "Knows" : "Needs steps"}</Chip>
                  </span>
                  <span className="flex gap-2">
                    <form action={toggleSkill}>
                      <input type="hidden" name="dish_key" value={skill.dish_key} />
                      <input type="hidden" name="knows" value={String(skill.knows)} />
                      <SubmitButton variant="quiet">{skill.knows ? "Needs steps" : "Knows it"}</SubmitButton>
                    </form>
                    <form action={deleteSkill}>
                      <input type="hidden" name="dish_key" value={skill.dish_key} />
                      <SubmitButton variant="quiet">Delete</SubmitButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
            <form action={addSkill} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="skill" className="sr-only">
                Dish name
              </label>
              <input id="skill" name="display_name" required className={inputClass} placeholder="Paneer bhurji" />
              <SubmitButton pending="Adding…">Add dish</SubmitButton>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeading>Connections</SectionHeading>
          <Card>
            <ul className="flex flex-col gap-2">
              <Status ok={configured.supabaseAdmin} label="Supabase secret key (cron, audio)" variable="SUPABASE_SECRET_KEY" />
              <Status ok={configured.gemini} label="Gemini (understanding notes, planning, voice)" variable="GEMINI_API_KEY" />
              <Status ok={configured.telegram} label="Telegram alerts" variable="TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" />
              <Status ok={configured.cron} label="Nightly plan and noon reminder" variable="CRON_SECRET" />
            </ul>
            <p className="mt-4">
              <Link href="/logs" className="font-bold underline underline-offset-4">
                See AI call logs
              </Link>
            </p>
          </Card>
        </section>

        <form action={signOut}>
          <SubmitButton pending="Signing out…">Sign out</SubmitButton>
        </form>
      </div>
    </>
  );
}

function PersonForm({ person }: { person: Person }) {
  return (
    <Card>
      <form action={savePerson} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={person.id} />
        <div className="col-span-2">
          <label htmlFor={`name-${person.id}`} className={labelClass}>
            {person.role === "me" ? "You" : "Second person"}
          </label>
          <input id={`name-${person.id}`} name="name" defaultValue={person.name} className={inputClass} />
        </div>
        <NumberField id="protein_min_g" scope={person.id} label="Protein per day, from (g)" value={person.protein_min_g} />
        <NumberField id="protein_max_g" scope={person.id} label="to (g)" value={person.protein_max_g} />
        <NumberField id="meal_protein_min_g" scope={person.id} label="Per cooked meal, from (g)" value={person.meal_protein_min_g} />
        <NumberField id="meal_protein_max_g" scope={person.id} label="to (g)" value={person.meal_protein_max_g} />
        <div className="col-span-2">
          <label htmlFor={`notes-${person.id}`} className={labelClass}>
            Notes for the planner
          </label>
          <input
            id={`notes-${person.id}`}
            name="notes"
            defaultValue={person.notes}
            className={inputClass}
            placeholder="Less oil, no karela"
          />
        </div>
        <div className="col-span-2">
          <SubmitButton pending="Saving…">Save</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

function NumberField({
  id,
  label,
  value,
  scope,
  type = "number",
}: {
  id: string;
  label: string;
  value: number | string;
  scope?: string;
  type?: "number" | "time";
}) {
  const htmlId = scope ? `${id}-${scope}` : id;
  return (
    <div>
      <label htmlFor={htmlId} className={labelClass}>
        {label}
      </label>
      <input id={htmlId} name={id} type={type} defaultValue={value} min={0} className={inputClass} />
    </div>
  );
}

function Status({ ok, label, variable }: { ok: boolean; label: string; variable: string }) {
  return (
    <li className="flex items-start gap-2">
      <Chip tone={ok ? "kothimbir" : "mirchi"}>{ok ? "Ready" : "Missing"}</Chip>
      <span>
        {label}
        {!ok && <span className="block text-small text-ink-muted">Add {variable} to the environment.</span>}
      </span>
    </li>
  );
}
