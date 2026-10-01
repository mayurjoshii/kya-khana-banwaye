import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { gemini, logCall } from "@/lib/llm/gemini";
import { ttsInstruction } from "@/lib/llm/prompts";
import { decodeWav, isWav } from "@/lib/wav";

import { encodeMp3, rateFromMime } from "./mp3";

/** Speaks `text` with Gemini TTS and returns an mp3. Logged to llm_logs. */
export async function speakToMp3(db: SupabaseClient, text: string, language: string): Promise<Uint8Array> {
  const ai = gemini();
  const model = env.geminiModelTts;
  const instruction = ttsInstruction(language);
  const prompt = instruction ? `${instruction}\n\n${text}` : text;
  const started = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: language,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: env.geminiTtsVoice } },
        },
      },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const data = part?.inlineData?.data;
    if (!data) throw new Error("The voice model returned no audio.");

    const bytes = new Uint8Array(Buffer.from(data, "base64"));
    let samples: Int16Array;
    let sampleRate: number;
    if (isWav(bytes)) {
      ({ samples, sampleRate } = decodeWav(bytes));
    } else {
      // Raw 16-bit little-endian PCM (audio/L16).
      const even = bytes.byteLength - (bytes.byteLength % 2);
      samples = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + even));
      sampleRate = rateFromMime(part?.inlineData?.mimeType);
    }
    const mp3 = encodeMp3(samples, sampleRate);

    await logCall(db, {
      purpose: "tts",
      model,
      prompt,
      response: `[audio ${part?.inlineData?.mimeType ?? "?"}, ${(samples.length / sampleRate).toFixed(1)} s, mp3 ${Math.round(mp3.byteLength / 1024)} KB]`,
      latency_ms: Date.now() - started,
      input_tokens: res.usageMetadata?.promptTokenCount ?? null,
      output_tokens: res.usageMetadata?.candidatesTokenCount ?? null,
      status: "ok",
    });
    return mp3;
  } catch (err) {
    await logCall(db, {
      purpose: "tts",
      model,
      prompt,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - started,
    });
    throw err;
  }
}
