// Which features are configured. Every key is optional: a missing one turns its
// feature into a "not configured" state instead of crashing the app.

const read = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const env = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: read("SUPABASE_SECRET_KEY"),
  geminiApiKey: read("GEMINI_API_KEY"),
  // TODO(owner): pin model IDs from AI Studio once tested.
  geminiModelText: read("GEMINI_MODEL_TEXT") ?? "gemini-flash-latest",
  geminiModelTts: read("GEMINI_MODEL_TTS") ?? "gemini-3.8-flash-tts",
  // TODO(owner): the voice that sounded best to the cook in the Phase 0 test.
  geminiTtsVoice: read("GEMINI_TTS_VOICE") ?? "Kore",
  telegramBotToken: read("TELEGRAM_BOT_TOKEN"),
  telegramChatId: read("TELEGRAM_CHAT_ID"),
  cronSecret: read("CRON_SECRET"),
  appUrl: (read("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
};

export const configured = {
  supabase: Boolean(env.supabaseUrl && env.supabasePublishableKey),
  supabaseAdmin: Boolean(env.supabaseUrl && env.supabaseSecretKey),
  gemini: Boolean(env.geminiApiKey),
  telegram: Boolean(env.telegramBotToken && env.telegramChatId),
  cron: Boolean(env.cronSecret),
};

export class NotConfiguredError extends Error {
  constructor(public readonly variable: string) {
    super(`Not configured: add ${variable} to the environment.`);
    this.name = "NotConfiguredError";
  }
}
