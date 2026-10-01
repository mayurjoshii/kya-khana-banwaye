"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { addTextInput, type InputResult } from "@/app/(app)/inputs/actions";
import { buttonClass, SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import { encodeWav, floatTo16 } from "@/lib/wav";

const MAX_SECONDS = 120;
const TARGET_RATE = 16000;

/** Re-encodes any recording the browser can decode as 16 kHz mono WAV, which Gemini reads. */
async function toWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const length = Math.ceil(decoded.duration * TARGET_RATE);
    const offline = new OfflineAudioContext(1, length, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const wav = encodeWav(floatTo16(rendered.getChannelData(0)), TARGET_RATE);
    return new Blob([wav as BlobPart], { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}

type VoiceState = "idle" | "recording" | "sending";

export function QuickInput() {
  const router = useRouter();
  const [textResult, action] = useActionState<InputResult | null, FormData>(addTextInput, null);
  const [voiceResult, setVoiceResult] = useState<InputResult | null>(null);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [shown, setShown] = useState<"text" | "voice">("text");

  useEffect(() => {
    if (textResult?.ok) formRef.current?.reset();
  }, [textResult]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function startRecording() {
    setVoiceResult(null);
    setShown("voice");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceResult({ ok: false, lines: ["Microphone blocked. Allow it in the browser, or type the note."] });
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      setVoice("sending");
      try {
        const wav = await toWav(new Blob(chunks, { type: rec.mimeType }));
        const body = new FormData();
        body.set("audio", wav, "note.wav");
        const res = await fetch("/api/inputs/voice", { method: "POST", body });
        const json = (await res.json()) as InputResult;
        setVoiceResult(json);
        if (json.ok) router.refresh();
      } catch {
        setVoiceResult({ ok: false, lines: ["Couldn't send the recording. Check the connection and try again."] });
      } finally {
        setVoice("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setVoice("recording");
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS && rec.state === "recording") rec.stop();
    }, 1000);
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  const result = shown === "voice" ? voiceResult : textResult;

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={action} onSubmit={() => setShown("text")} className="flex flex-col gap-3">
        <label htmlFor="quick-text" className="sr-only">
          Tell the app something
        </label>
        <textarea
          id="quick-text"
          name="text"
          rows={2}
          className={inputClass}
          placeholder="Bought 500 g paneer. No eggs tomorrow. Craving rajma."
        />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Reading…">Send note</SubmitButton>
          {voice === "recording" ? (
            <button type="button" onClick={stopRecording} className={buttonClass("voice")}>
              <span className="h-3 w-3 rounded-full bg-ink" aria-hidden />
              Stop · {seconds}s
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={voice === "sending"}
              className={buttonClass("voice")}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM19 11a7 7 0 0 1-14 0M12 18v3" />
              </svg>
              {voice === "sending" ? "Listening…" : "Record"}
            </button>
          )}
        </div>
      </form>
      {result && (
        <ul
          className={`rounded-sm px-4 py-3 text-small ${result.ok ? "bg-paper-2" : "bg-mirchi"}`}
          role="status"
          aria-live="polite"
        >
          {result.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
