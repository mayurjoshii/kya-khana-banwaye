# Cook Assistant

A personal app that plans the cook's daily visit around two people's protein goals and tastes, the cook's limits and what's in the fridge. It then makes a short Hindi voice note to forward to her on WhatsApp.

- Product decisions, data model and phases: [`PLAN.md`](PLAN.md)
- Questions for the owner that came up during the build: [`agent-open-question.md`](agent-open-question.md)

## Run locally

```bash
pnpm install
cp .env.example .env.local   # fill in what you have; every key is optional
pnpm dev                      # http://localhost:3000
```

Without Supabase keys, the app opens a setup page. Without other keys, the matching features show "not configured".

```bash
pnpm test        # unit tests (rules, matching, dates, audio encoding)
pnpm lint
pnpm typecheck
pnpm build
```

## Set up the services

All free tiers.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/20261002000000_init.sql`](supabase/migrations/20261002000000_init.sql), then [`supabase/seed.sql`](supabase/seed.sql).
3. Authentication → Sign In / Providers → Email: turn off **Allow new users to sign up**.
4. Authentication → Users → **Add user**: your email and a password. This is the only login.
5. Project settings → API keys: copy the URL, the publishable key and the secret key into `.env.local`.

### 2. Gemini

1. Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`.
2. In AI Studio, check the current model IDs and your rate limits. Set `GEMINI_MODEL_TEXT` and `GEMINI_MODEL_TTS` if the defaults have changed.
3. Set `GEMINI_TTS_VOICE` to the voice the cook understood best.

On the free tier, Google may use what you send to improve its products. The prompts contain food, quantities and first names only.

### 3. Telegram

1. Message [@BotFather](https://t.me/BotFather), run `/newbot` and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `message.chat.id` into `TELEGRAM_CHAT_ID`.

### 4. Vercel

1. Import the repo into Vercel (Hobby plan).
2. Add every variable from `.env.local`, plus `CRON_SECRET` (any long random string) and `APP_URL` (your Vercel URL).
3. Deploy. [`vercel.json`](vercel.json) registers two daily crons, in UTC:
   - `/api/cron/plan` at 15:00 UTC (20:30 IST): plans tomorrow, makes the audio, pings you.
   - `/api/cron/remind` at 06:30 UTC (12:00 IST): reminds you if today's note isn't sent.

   Hobby crons can run up to an hour late. Every step also has a button in the app.

## How a day works

1. Through the day, tell the app things on the Today screen by text or voice: "bought 500 g paneer", "no eggs tomorrow", "craving rajma".
2. At about 20:30 IST, tomorrow's plan arrives on Telegram with any missing items. Tap **Buy** or **Swap** for each.
3. The Hindi voice note is ready by then. Before the cook arrives at 12:30, open Today, tap **Send to cook** and pick her chat in WhatsApp.
4. After the meal, leave feedback in History. It shapes the next plans.

## First week (pilot)

- [ ] **Day 0:** fill in Settings: both names, the cook's name, the dishes she knows, your main likes and dislikes. Add what's in the fridge.
- [ ] **Day 0:** on Today, tap **Plan tomorrow**, then **Make the voice note**. Play it. If the voice reads the style line aloud, see question 7 in `agent-open-question.md`.
- [ ] **Day 1:** send the note to the cook. Ask her if the speed, voice and words were clear. Change `GEMINI_TTS_VOICE` if not.
- [ ] **Every day:** tell the app what you bought and what ran out (Today → Record works best). Check the 20:30 Telegram message and tap Buy or Swap.
- [ ] **Every day:** after the meal, rate it in History and note anything the cook struggled with.
- [ ] **Day 3:** open Settings → See AI call logs. Look for `invalid` or `error` rows and for prompts getting long.
- [ ] **Day 7:** review the open questions file and the dish limits. Adjust the rules, the protein targets and the staples list.

## What runs where

| Piece | Code |
| --- | --- |
| Plan a visit | `lib/planner/run.ts` (context → menu → rules in code → steps → missing items) |
| Rules checked in code | `lib/planner/rules.ts` |
| Voice note | `lib/audio.ts` (script → `lib/tts/speak.ts` → mp3 → storage) |
| Notes by text or voice | `lib/inputs.ts`, `app/api/inputs/voice/route.ts` |
| Fridge changes | `lib/plans.ts` (`afterFridgeChange`, `markSent`) |
| Prompts | `lib/llm/prompts.ts` |
| Crons | `app/api/cron/plan`, `app/api/cron/remind`, `vercel.json` |
