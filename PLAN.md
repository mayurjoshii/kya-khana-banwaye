# Cook Assistant: Build Plan (v2)

The source of truth for any agent building this app. Read it fully before writing code, and update it when a decision changes.

- Original plan: v1 (Oct 2, 2026). This version folds in the review and the owner's answers.
- Design system: https://claude.ai/artifact/Qow2kEMyJGvnPb96V4EBxD (tokens, type, usage rules). Read its `project/README.md` and `project/tokens.json` with the Artifact tool.

## How to work on this

- **Approval gate:** do not start the build (installing packages, writing app code, running migrations) until the owner approves. After approval, build every phase in order without stopping for questions.
- **Placeholders, not blockers:** anything that needs a key, an account or owner input gets a working placeholder plus a `TODO(owner):` comment, and is listed in [Open items](#open-items). The app must build and run with no keys set, showing a "not configured" state wherever a key is missing.
- **Target:** about 80% of the app live before keys are added. Then the owner adds keys and fills placeholders.
- **Next.js 16 differs from older versions** (for example, `middleware.ts` is now `proxy.ts`). Check `node_modules/next/dist/docs/` before using any Next API (see `AGENTS.md`).
- Commit at the end of each phase with a clear message. Run `pnpm lint`, `pnpm test` and `pnpm build` before each commit.

## Product in one paragraph

A personal web app for one household. It plans the cook's daily visit (lunch plus dinner or snacks) around two adults' protein goals and tastes, what the cook can make in an hour, and what's in the fridge. It then produces a short **Hindi** voice note that the owner forwards to the cook on WhatsApp. Planning is fully automatic, and the final send is manual. Cost: $0 per month on free tiers, $1 ceiling.

## Settled decisions

| Topic | Decision |
| --- | --- |
| Household | 2 adults, around 30 years old. Every quantity is for 2 servings. |
| Diet | Vegetarian plus eggs, enforced in code (reject meat or fish). No egg-free days. One-off exceptions arrive as inputs ("no eggs tomorrow"). |
| Protein | 60–70 g/day per person. Cook's food targets **25–30 g per person per meal**. Protein powder and other food cover the rest. |
| Visit | One visit a day, arriving ~12:30–13:00 and staying 60 min. A plan is **per visit** (one row per date), not per meal. |
| Meals covered | Default **lunch + dinner**. The owner can switch a day to **lunch + snacks** with one tap, which re-plans. |
| Dish limit | **Everything counts as a dish**, including roti, rice and salad. Up to 3 dishes if any is complex, up to 4 if all are simple. The limit covers the whole visit; a dish served at both meals counts once. |
| Pantry staples | An editable staples list (atta, rice, common dals, oil, onion, tomato, ginger, garlic, green chilli, basic spices, salt, sugar, tea) counts as in stock until the owner marks one as out. Staples never trigger missing-item alerts. |
| Plan timing | Nightly plan for tomorrow at ~20:30 IST (time to shop that evening or morning). Reminder at ~12:00 IST if not sent. |
| Cook-facing language | **Hindi** (`hi-IN`) script and audio. `cook_profile.language` keeps Marathi switchable later. |
| Cook's known dishes | Placeholder seed list, `TODO(owner)`. A dish she has cooked twice from steps becomes "known". |
| Users | One login (owner). Both people sit together to review. Preferences can be tagged to a person or both. A second login comes later. |
| Alerts | Telegram bot. |
| Auth | Supabase Auth, email and password, sign-ups turned off, row-level security (RLS) on every table. |
| Phase 0 | Voice test done with the cook (WhatsApp audio works). |

### Assumptions (confirm later; build with these)

- Both people have the same 60–70 g target. Each person's target is stored separately, so it's easy to change.
- Nightly planning at 20:30 IST was the recommendation and wasn't contradicted.
- Snacks also aim for ~25–30 g per person, the same as a meal. TODO(owner): confirm.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| App, API, cron | Next.js 16 (App Router) on Vercel Hobby | Route handlers and server actions are the backend. Hobby cron runs once a day per job, up to 59 min late, in UTC. Function limit is 300 s with fluid compute. |
| Database | Supabase Postgres (free) | Pauses after 7 days without DB activity; the daily cron queries it every run. |
| Storage | Supabase Storage, private bucket `plan-audio` | Signed URLs only. |
| Auth | Supabase Auth via `@supabase/ssr` | Sessions refreshed in `proxy.ts`. |
| LLM, transcription, TTS | Gemini via Google AI Studio key, `@google/genai` | One key for everything. TTS returns raw 24 kHz 16-bit mono audio (PCM), which is encoded to mp3 on the server. Model IDs come from env (see below). |
| Validation | zod v4 | `z.toJSONSchema()` feeds Gemini's structured output. |
| Alerts | Telegram Bot API via plain `fetch` | `sendMessage` and `sendAudio`. Buttons are URL buttons into the app, so no webhook is needed in v1. |
| Styling | Tailwind v4, tokens from the design system | Fonts via `next/font/google`: Shrikhand (display), Baloo 2 (everything else, covers Devanagari). |
| Tests | Vitest | Pure logic: rules, missing items, protein, dates, name normalisation, audio encoding. |
| Errors | Vercel logs plus `llm_logs` | Sentry later, only if needed. |

## Environment variables

All server-only (no `NEXT_PUBLIC_` prefix) except the two Supabase public values. Put them in `.env.example` with comments.

| Variable | Purpose | Placeholder behaviour if missing |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client | App shows a setup screen instead of login |
| `SUPABASE_SECRET_KEY` | Cron and storage on the server | Cron and audio return "not configured" |
| `GEMINI_API_KEY` | All LLM calls | Inputs are saved unprocessed; Plan and Audio buttons show "add GEMINI_API_KEY" |
| `GEMINI_MODEL_TEXT` | Extraction, planning, recipes, script | Default `gemini-flash-latest`. TODO(owner): pin a model ID |
| `GEMINI_MODEL_TTS` | Hindi TTS | TODO(owner): set the current Flash TTS model ID from AI Studio |
| `GEMINI_TTS_VOICE` | Voice name | TODO(owner): pick the voice that tested best with the cook |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Alerts | Alerts go to the server log only |
| `CRON_SECRET` | Protects `/api/cron/*` (Vercel sends `Authorization: Bearer <secret>`) | Cron routes refuse all calls |
| `APP_URL` | Links in Telegram messages | Defaults to `http://localhost:3000` |

## Folder layout

```
app/
  (auth)/login/            login page
  (app)/                   signed-in shell with bottom tab bar
    page.tsx               Today: upcoming plan, quick input
    fridge/                fridge and staples
    inputs/                input history and what was extracted
    history/               past plans and feedback
    settings/              people, cook profile, rules, skills
    logs/                  llm_logs viewer
  api/
    cron/plan/route.ts     nightly: plan tomorrow, then audio, then notify
    cron/remind/route.ts   noon: remind if today's plan isn't sent
    inputs/voice/route.ts  upload a recording for transcription and extraction
lib/
  supabase/                server, browser and admin clients, generated-by-hand types
  llm/                     Gemini client, prompts, zod schemas, logging wrapper (server-only)
  planner/                 context builder, rule checks, missing items, protein, pipeline
  tts/                     Hindi script to PCM to mp3
  notify/                  Telegram
  time.ts                  IST helpers (upcoming visit date, "today" in IST)
  normalize.ts             dish and ingredient name keys
  env.ts                   which features are configured
supabase/
  migrations/<ts>_init.sql tables, enums, RLS, storage bucket
  seed.sql                 people, cook profile, staples, placeholder skills and rules
proxy.ts                   session refresh and auth redirect
vercel.json                cron schedules
```

Everything under `lib/llm`, `lib/tts`, `lib/notify` and the admin Supabase client starts with `import "server-only"`.

## Data model

All tables have RLS enabled, with policy "authenticated users can do everything" (only the owner can sign in). Cron uses the service role. Timestamps are `timestamptz`; plan dates are `date` in IST.

| Table | Purpose | Key fields |
| --- | --- | --- |
| `people` | The two adults | id, name (TODO placeholder names), protein_min_g 60, protein_max_g 70, meal_protein_min_g 25, meal_protein_max_g 30, notes |
| `preferences` | Likes, dislikes, cravings, avoids | id, person_id (null = both), kind (`like` `dislike` `craving` `avoid` `note`), item, strength 1–3, expires_at (null = permanent), source_input_id, active, created_at |
| `user_inputs` | Raw notes | id, text, source (`text` `voice`), created_at, processed_at, extraction jsonb, error |
| `cook_profile` | Single row (id = 1) | name, visit_time 12:30, visit_minutes 60, max_dishes_simple 4, max_dishes_complex 3, servings 2, language `hi-IN`, default_mode `lunch_dinner` |
| `cook_rules` | Editable extra rules | id, rule, kind (`hard` `soft`), active, created_at |
| `cook_skills` | What she knows | dish_key (unique), display_name, knows bool, times_cooked_with_steps int, notes |
| `fridge_items` | Stock, including staples | id, item_key (unique), display_name, quantity text, is_staple bool, in_stock bool, last_confirmed_at, updated_at |
| `recipes` | Cached dishes and steps | dish_key (unique), display_name, display_name_hi, complexity (`simple` `complex`), minutes, protein_g_per_serving, ingredients jsonb `[{item, quantity, unit}]`, steps_hi text[], created_at |
| `meal_plans` | One per visit date | id, plan_date (unique), mode (`lunch_dinner` `lunch_snacks`), dishes jsonb, missing_items jsonb `[{item, quantity, dish, decision: pending/buy/swap}]`, protein jsonb, warnings jsonb, status, error, script_hi, audio_path, version int, created_at, updated_at, sent_at |
| `plan_feedback` | What worked | id, plan_id, rating 1–5, cook_issue, notes, created_at |
| `llm_logs` | Observability | id, purpose, model, prompt, response, latency_ms, input_tokens, output_tokens, status (`ok` `invalid` `error`), error, created_at |

**Plan status:** `planning` → `planned` → `audio_ready` → `sent`. Any step can go to `failed` (with `error`). `stale` means the fridge changed in a way that breaks the plan.

## Core logic

### Names

`normalize.ts` lowercases, trims, collapses spaces, strips quantities, and maps a few synonyms (e.g. "curd"/"dahi", "capsicum"/"shimla mirch"). Every dish and ingredient lookup uses these keys.

### Upcoming visit date (`time.ts`)

All times are IST (`Asia/Kolkata`). Before visit end (visit_time + visit_minutes), the upcoming visit is today; after it, tomorrow.

### Input extraction (Phase 2)

One Gemini call per note returns a validated `Extraction`:

- `preferences[]`: person (`me` / `partner` / `both`), kind, item, expiry (`today` / `tomorrow` / `week` / `permanent`)
- `fridge[]`: item, quantity, action (`add` / `used_up` / `out`)
- `goal_changes[]`
- `cook_rules[]`
- `mode_for_next_visit` (`lunch_dinner` / `lunch_snacks` / null)
- `unhandled`: text it couldn't place

For voice, the same call takes the audio plus the prompt and also returns the transcript. Results are applied in one transaction-like sequence and stored on the input row. Invalid output retries once with the zod error; it then stays unprocessed with an error and shows in the Inputs screen.

### Planner pipeline (Phase 3)

1. **Context:**
   - people targets
   - active, unexpired preferences (top dislikes first)
   - cook profile and active rules
   - known dishes
   - in-stock fridge items and staples
   - last 7 days of plans
   - mode

   Keep the prompt small. No personal details beyond food.
2. **Menu call:** JSON matching `MenuSchema`. Each dish has name, name_hi, meals (`lunch` / `dinner` / `snack`, one or more), complexity, minutes, protein_g_total (for 2 people), and ingredients with quantities.
3. **Code checks** (`planner/rules.ts`, unit tested):
   - Hard:
     - unique dish count ≤ limit (3 if any complex, else 4)
     - every meal in the mode has at least one dish
     - no meat or fish (blocklist on ingredient and dish keys)
     - no dish from the last 7 days
     - nothing matching an active `avoid` or `dislike`
     - active hard `cook_rules` are sent in the prompt only (free text can't be checked in code)
   - Soft (become `warnings`):
     - total minutes > visit_minutes
     - protein per person per meal below meal_protein_min_g
4. **Retry:** hard failures retry once, with the violations listed in the prompt. A second failure sets the plan to `failed` and sends a Telegram alert. There's no fallback to an old menu, because the old menu may not match the fridge.
5. **Missing items:** ingredients that aren't in-stock fridge items or in-stock staples. Each starts `pending`.
6. **Recipes:**
   - For dishes the cook doesn't know and that have no cached recipe, one batched Gemini call writes short Hindi steps (one step per line, household units like कटोरी and चम्मच).
   - Results are cached in `recipes`.
   - Known dishes need no steps.
7. Save as `planned` (upsert on plan_date, version + 1), then send a Telegram summary with dishes, protein, missing items and a link to Today.

### Missing items and fridge changes (Phase 4)

- **Buy:** marks the item as being bought; the audio can proceed.
- **Swap:** re-plans with that ingredient excluded.
- **Item added to fridge:** recompute missing items in code (no LLM).
- **Item used by an unsent plan marked out:** the plan becomes `stale`, Today shows **Regenerate**, and Telegram sends a ping.
- **Mode switch** (dinner vs snacks): re-plans.

### Audio pipeline (Phase 5)

1. **Script call:** a short Hindi script.
   - Greeting.
   - Dishes for lunch, then dinner or snacks.
   - Steps only for unknown dishes.
   - Missing-item note if any were bought late.
   - Under ~90 seconds when spoken.

   It's stored as `script_hi` and shown in the app for review.
2. **TTS:** Gemini TTS (`hi-IN`, configured voice) → PCM → mp3 (pure-JS encoder) → upload to `plan-audio/<plan_date>-v<version>.mp3` → `audio_ready`.
3. **Telegram:** `sendAudio` with the mp3 and a link to Today.
4. **Today screen:**
   - Audio player.
   - The script.
   - **Send to cook:** Web Share API with the mp3 file, which opens WhatsApp. If the browser can't share files, download it instead.
   - **Mark as sent** (also set automatically after a successful share).
5. **TTS failure:** send the text script to Telegram instead, keep `planned`, and save the error.
6. After a plan is marked `sent`, its non-staple ingredients are marked `used_up` (fridge stays fresh), and `times_cooked_with_steps` goes up for dishes that had steps.

### Cron (`vercel.json`, UTC)

| Job | Schedule | IST | Does |
| --- | --- | --- | --- |
| `/api/cron/plan` | `0 15 * * *` | 20:30 | Plan tomorrow → audio → Telegram. Also keeps Supabase awake. |
| `/api/cron/remind` | `30 6 * * *` | 12:00 | Telegram reminder if today's plan isn't `sent`; failure alert if there's no plan. |

Both check `CRON_SECRET`. Every step is also available as a button, so nothing depends on cron precision.

### LLM wrapper (`lib/llm`)

- One `callGemini({ purpose, schema, prompt, audio? })`. It sends `responseMimeType: application/json` and the JSON schema, validates with zod, retries once on invalid output with the error, and writes every attempt to `llm_logs` with latency and token counts.
- Prompts live in `lib/llm/prompts.ts`, one function per purpose.

## UI

Follow the design system README.

- **Visual style:**
  - `paper` ground, `ink` text.
  - Accents carry meaning: `haldi` for primary, `kothimbir` for done, `mirchi` for missing or failed (always with a word), `neel` for voice and audio.
  - Text on accents is `ink`.
  - Pills for buttons and chips; cards use `radius-lg`.
  - One `shadow-pop` element per screen (the primary action).
- **Fonts:** Shrikhand only for page titles and the day's menu name; Baloo 2 for everything else; a `hindi` text style (19/30) for cook-facing text.
- **Copy:** sentence case, no em dashes, errors that give the fix, no emoji.
- **Layout:** mobile-first with a bottom tab bar (Today, Fridge, Inputs, History, Settings), and Logs reached from Settings. Respect reduced motion. The only animation is dishes dropping in when a plan arrives.

**Screens:**

- **Today:**
  - Status chip.
  - Menu card grouped by meal, with protein per person per meal and a "cook knows" / "steps included" tag.
  - Warnings.
  - Missing items with Buy / Swap.
  - Mode toggle.
  - Plan now / Regenerate.
  - Audio player, script, Send to cook, Mark as sent.
  - Quick input (text box plus record button).
- **Fridge:** in-stock items with quantity and last confirmed date, add item, mark out, and a staples section with toggles.
- **Inputs:** history with source, transcript, what was applied, errors, and a retry button.
- **History:** past plans and a feedback form (rating, cook issue, notes).
- **Settings:**
  - people and their targets
  - cook profile (visit time, minutes, limits, language)
  - cook rules (add, toggle, delete)
  - cook skills (add, toggle knows)
  - configuration status (which env keys are set)
  - link to Logs
- **Logs:** latest 100 LLM calls, expandable prompt and response.

## Phases

Build in order. Each phase ends with lint, test and build passing, then a commit.

**Phase 1: Foundation**

- Install deps: `@supabase/ssr`, `@supabase/supabase-js`, `@google/genai`, `zod`, `server-only`, an mp3 encoder, and `vitest`.
- `env.ts`, the Supabase clients, `proxy.ts`, and the login page.
- Signed-in shell with tab bar and design tokens in `globals.css` (`@theme`).
- Migration with all tables, enums, RLS and the storage bucket; `seed.sql` with placeholders.
- Settings screen editing people, cook profile, rules, skills and staples.
- `.env.example` and `README.md` setup steps (create a Supabase project, run the SQL, turn off sign-ups, create the user, set env, deploy to Vercel).

**Phase 2: Inputs**

- `lib/llm` wrapper with logging; `ExtractionSchema` and prompt.
- Text input server action; voice recording in the browser (MediaRecorder) → `/api/inputs/voice`.
- Apply extraction to tables.
- Fridge screen, Inputs screen with retry.

**Phase 3: Planner**

- `normalize.ts`, `time.ts`, `planner/context.ts`, `planner/rules.ts`, `planner/missing.ts`, `planner/protein.ts` (all unit tested).
- Menu and recipe schemas and prompts; `planner/run.ts`.
- **Plan now** on Today; Today menu card, warnings, missing items; status handling.

**Phase 4: Schedule and alerts**

- `lib/notify/telegram.ts` (logs only if not configured).
- `/api/cron/plan`, `/api/cron/remind`, `vercel.json`.
- Buy / Swap actions; fridge-change handling (recompute or `stale`); mode switch re-plan; failure alerts.

**Phase 5: Audio**

- Script schema and prompt.
- `lib/tts`: Gemini TTS → PCM → mp3 (unit test the encoder on a generated tone).
- Upload to storage and signed URL; Telegram `sendAudio`; text fallback.
- Today: player, script, Send to cook (Web Share), Mark as sent, post-send fridge and skills updates.
- Cron plan route chains audio after planning.

**Phase 6: Pilot tooling**

- History screen and feedback form; recent feedback fed into the planning prompt.
- Logs screen.
- README "first week" checklist.

**Phase 7 (later, not now):** speaker or button for the cook, automated sending, the second person's login, YouTube, nutrition beyond protein.

## Open items

Fill these in after the build. Each one also appears as `TODO(owner)` in code.

- [ ] Supabase project, URL, anon key and service role key; run migration and seed; turn off sign-ups; create the owner user.
- [ ] Gemini API key, text model ID, TTS model ID, Hindi voice name (from the Phase 0 test).
- [ ] Telegram bot token (from @BotFather) and chat ID.
- [ ] `CRON_SECRET` and `APP_URL`; deploy to Vercel.
- [ ] Names of both people; confirm both have a 60–70 g target and that snacks use the same per-meal target.
- [ ] Cook's name and the dishes she already knows (10–20).
- [ ] Initial likes and dislikes for both people; any extra cook rules.
- [ ] Check the staples list.
- [ ] Update the design system README and the `marathi` text style to Hindi.
