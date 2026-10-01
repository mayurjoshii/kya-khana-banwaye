import "server-only";

import { configured, env } from "@/lib/env";

// Telegram Bot API over plain fetch. Without a token, messages go to the
// server log so nothing breaks in development.

export interface LinkButton {
  text: string;
  url: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export { escapeHtml };

function api(method: string) {
  return `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;
}

function keyboard(buttons?: LinkButton[]) {
  if (!buttons?.length) return undefined;
  // Telegram rejects localhost URLs on buttons; links stay in the text then.
  const usable = buttons.filter((b) => b.url.startsWith("https://"));
  if (!usable.length) return undefined;
  return { inline_keyboard: usable.map((b) => [{ text: b.text, url: b.url }]) };
}

/** Sends an HTML message. Returns false (and logs) when it can't be sent. */
export async function sendMessage(html: string, buttons?: LinkButton[]): Promise<boolean> {
  if (!configured.telegram) {
    console.info(`[telegram not configured]\n${html}`);
    return false;
  }
  try {
    const res = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramChatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard(buttons),
      }),
    });
    if (!res.ok) console.error("Telegram sendMessage failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Telegram sendMessage failed:", err);
    return false;
  }
}

/** Sends an mp3 with a caption. Returns false (and logs) when it can't be sent. */
export async function sendAudio(
  mp3: Uint8Array,
  filename: string,
  captionHtml: string,
  buttons?: LinkButton[],
): Promise<boolean> {
  if (!configured.telegram) {
    console.info(`[telegram not configured] audio ${filename} (${mp3.byteLength} bytes)\n${captionHtml}`);
    return false;
  }
  try {
    const form = new FormData();
    form.set("chat_id", env.telegramChatId!);
    form.set("caption", captionHtml.slice(0, 1000));
    form.set("parse_mode", "HTML");
    form.set("title", filename.replace(/\.mp3$/, ""));
    const markup = keyboard(buttons);
    if (markup) form.set("reply_markup", JSON.stringify(markup));
    form.set("audio", new Blob([mp3 as BlobPart], { type: "audio/mpeg" }), filename);
    const res = await fetch(api("sendAudio"), { method: "POST", body: form });
    if (!res.ok) console.error("Telegram sendAudio failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Telegram sendAudio failed:", err);
    return false;
  }
}

export const appLink = (path = "/") => `${env.appUrl}${path}`;
