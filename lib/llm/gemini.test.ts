import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

function fakeDb() {
  const logs: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        logs.push(row);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, logs };
}

const reply = (text: string) => ({ text, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });

describe("callJson", () => {
  beforeEach(() => {
    vi.resetModules();
    generateContent.mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  it("retries once on invalid output and logs both attempts", async () => {
    const { callJson } = await import("./gemini");
    const { db, logs } = fakeDb();
    generateContent.mockResolvedValueOnce(reply('{"name": 5}')).mockResolvedValueOnce(reply('{"name": "Dal"}'));

    const result = await callJson({ db, purpose: "test", schema: z.object({ name: z.string() }), system: "s", prompt: "p" });

    expect(result).toEqual({ name: "Dal" });
    expect(logs.map((l) => l.status)).toEqual(["invalid", "ok"]);
    const retryPrompt = generateContent.mock.calls[1][0].contents[0].parts.at(-1).text as string;
    expect(retryPrompt).toContain("did not match the required JSON shape");
    expect(generateContent.mock.calls[0][0].config.responseJsonSchema).toMatchObject({ type: "object" });
  });

  it("gives up after two invalid answers", async () => {
    const { callJson } = await import("./gemini");
    const { db } = fakeDb();
    generateContent.mockResolvedValue(reply("not json"));
    await expect(
      callJson({ db, purpose: "test", schema: z.object({ name: z.string() }), system: "s", prompt: "p" }),
    ).rejects.toThrow(/invalid test twice/);
  });

  it("refuses to run without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { callJson } = await import("./gemini");
    const { db } = fakeDb();
    await expect(callJson({ db, purpose: "t", schema: z.object({}), system: "s", prompt: "p" })).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });
});

describe("speakToMp3", () => {
  beforeEach(() => {
    vi.resetModules();
    generateContent.mockReset();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  const tone = Int16Array.from({ length: 24000 }, (_, i) => Math.round(Math.sin(i / 10) * 5000));

  it("encodes raw PCM from Gemini as mp3", async () => {
    const { speakToMp3 } = await import("@/lib/tts/speak");
    const { db, logs } = fakeDb();
    generateContent.mockResolvedValue({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: Buffer.from(tone.buffer).toString("base64") } }] } },
      ],
    });
    const mp3 = await speakToMp3(db, "नमस्ते", "hi-IN");
    expect(mp3[0]).toBe(0xff);
    expect(logs[0]).toMatchObject({ purpose: "tts", status: "ok" });
    expect(generateContent.mock.calls[0][0].config.speechConfig.languageCode).toBe("hi-IN");
  });

  it("accepts WAV output too", async () => {
    const { speakToMp3 } = await import("@/lib/tts/speak");
    const { encodeWav } = await import("@/lib/wav");
    const { db } = fakeDb();
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: Buffer.from(encodeWav(tone, 24000)).toString("base64") } }] } }],
    });
    expect((await speakToMp3(db, "नमस्ते", "hi-IN")).length).toBeGreaterThan(1000);
  });

  it("fails clearly when no audio comes back", async () => {
    const { speakToMp3 } = await import("@/lib/tts/speak");
    const { db, logs } = fakeDb();
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: "sorry" }] } }] });
    await expect(speakToMp3(db, "x", "hi-IN")).rejects.toThrow(/no audio/);
    expect(logs[0]).toMatchObject({ status: "error" });
  });
});
