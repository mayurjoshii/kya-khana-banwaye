# Open questions from the build

Decisions the agent made without stopping. Each one has a default already built in; change any of them by replying here or telling the agent.

| # | Question | What the build does now | Where |
| --- | --- | --- | --- |
| 1 | Does the second person also need 60–70 g of protein a day? (Q1 was not answered.) | Both people start at 60–70 g/day and 25–30 g per cooked meal. Each is editable in Settings. | `supabase/seed.sql`, Settings → People |
| 2 | Should snacks also aim for 25–30 g per person? | Yes, snacks use the same per-meal target as lunch and dinner. | `lib/planner/rules.ts` |
| 3 | Roti, rice and salad count as dishes (your Q4 answer). Should they also count as repeats? Roti every day would otherwise break "no repeats in 7 days". | Everyday basics never count as repeats: roti, rice, salad, curd, raita, jeera rice. Edit `REPEAT_OK` to change the list. | `lib/planner/rules.ts` |
| 4 | On a complex day the limit is 3 dishes *including* roti or rice, which leaves room for only 1–2 real dishes across lunch and dinner. Raise the complex-day limit to 4? | Kept at 3, as decided. A dish served at both lunch and dinner counts once. Editable in Settings → Cook. | Settings → Cook |
| 5 | When a plan is marked sent, should its ingredients be marked out of stock? Some will be partly used (half a pack of paneer). | Non-staple ingredients are marked out of stock, so the next plan doesn't assume them. Mark anything left over as back in stock on the Fridge screen. | `lib/plans.ts` |
| 6 | Supabase has renamed its keys. | The app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. The legacy anon and service_role keys also work in those variables. | `.env.example` |
| 7 | Gemini TTS is given a short style line ("Read this Hindi note slowly and clearly…") before the script. Some voices read such lines aloud. | The style line is sent. If you hear it in the audio, set `ttsInstruction` to return `""`. | `lib/llm/prompts.ts` |
| 8 | Shared from the app, the mp3 arrives in WhatsApp as an audio file, not a green "voice note" bubble. Is that fine for the cook? | mp3 file, which plays on any phone. A true voice-note bubble needs OGG/Opus, which needs a native encoder. | `components/send-to-cook.tsx` |
| 9 | Voice inputs: the recording isn't stored, so a failed transcription can't be retried later. | The error is shown right away with "Record it again or type it". Storing recordings would use Storage space and keep more personal audio. | `app/api/inputs/voice/route.ts` |
| 10 | The nightly cron keeps a plan you made by hand that evening and only makes its voice note. Should it re-plan instead? | Keeps your plan. A stale or failed plan is replaced. | `app/api/cron/plan/route.ts` |
