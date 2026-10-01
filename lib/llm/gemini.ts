import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { configured, env, NotConfiguredError } from "@/lib/env";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!configured.gemini) throw new NotConfiguredError("GEMINI_API_KEY");
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey! });
  return client;
}

export interface LogEntry {
  purpose: string;
  model: string;
  prompt: string;
  response?: string | null;
  latency_ms?: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  status: "ok" | "invalid" | "error";
  error?: string | null;
}

/** Writes one row to llm_logs. Never throws: logging must not break a run. */
export async function logCall(db: SupabaseClient, entry: LogEntry) {
  try {
    const { error } = await db.from("llm_logs").insert(entry);
    if (error) console.error("llm_logs insert failed:", error.message);
  } catch (err) {
    console.error("llm_logs insert failed:", err);
  }
}

/** JSON Schema for Gemini's structured output, from a zod schema. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export class LlmOutputError extends Error {
  constructor(
    message: string,
    public readonly raw: string | null,
  ) {
    super(message);
    this.name = "LlmOutputError";
  }
}

/**
 * Calls Gemini for JSON matching `schema`. Invalid output is retried once with
 * the validation errors; every attempt is written to llm_logs.
 */
export async function callJson<S extends z.ZodType>(opts: {
  db: SupabaseClient;
  purpose: string;
  schema: S;
  system: string;
  prompt: string;
  audio?: { data: string; mimeType: string };
  /** Extra check after the schema passes. Return problems to retry once with them. */
  validate?: (value: z.infer<S>) => string[];
}): Promise<z.infer<S>> {
  const ai = gemini();
  const model = env.geminiModelText;
  const responseJsonSchema = toGeminiSchema(opts.schema);
  let prompt = opts.prompt;
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    if (opts.audio) parts.push({ inlineData: opts.audio });
    parts.push({ text: prompt });
    const logPrompt = `${opts.system}\n\n---\n\n${opts.audio ? `[audio ${Math.round((opts.audio.data.length * 3) / 4 / 1024)} KB, ${opts.audio.mimeType}]\n\n` : ""}${prompt}`;

    let raw: string | null = null;
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0.4,
        },
      });
      raw = res.text ?? "";
      const usage = {
        latency_ms: Date.now() - started,
        input_tokens: res.usageMetadata?.promptTokenCount ?? null,
        output_tokens: res.usageMetadata?.candidatesTokenCount ?? null,
      };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
      const result = opts.schema.safeParse(parsed);
      const problems = result.success
        ? (opts.validate?.(result.data) ?? [])
        : result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

      if (problems.length === 0) {
        await logCall(opts.db, { purpose: opts.purpose, model, prompt: logPrompt, response: raw, status: "ok", ...usage });
        return result.data as z.infer<S>;
      }

      lastError = problems.join("\n");
      await logCall(opts.db, {
        purpose: opts.purpose,
        model,
        prompt: logPrompt,
        response: raw,
        status: "invalid",
        error: lastError,
        ...usage,
      });
      prompt = `${opts.prompt}\n\nYour previous answer broke these rules:\n${lastError}\nReturn a corrected answer that follows every rule.`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logCall(opts.db, {
        purpose: opts.purpose,
        model,
        prompt: logPrompt,
        response: raw,
        status: "error",
        error: message,
        latency_ms: Date.now() - started,
      });
      throw err;
    }
  }
  throw new LlmOutputError(`Gemini returned an invalid ${opts.purpose} twice:\n${lastError}`, null);
}
