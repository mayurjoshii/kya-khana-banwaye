// PCM to mp3 with a pure-JS encoder, so it runs on Vercel without ffmpeg.

import { Mp3Encoder } from "@breezystack/lamejs";

const FRAME = 1152;

/** Encodes 16-bit mono PCM. 64 kbps keeps a 90-second note around 700 KB. */
export function encodeMp3(samples: Int16Array, sampleRate: number, kbps = 64): Uint8Array {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += FRAME) {
    const out = encoder.encodeBuffer(samples.subarray(i, i + FRAME));
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const mp3 = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    mp3.set(c, offset);
    offset += c.length;
  }
  return mp3;
}

/** Sample rate from a mime type like "audio/L16;codec=pcm;rate=24000". */
export function rateFromMime(mimeType: string | undefined, fallback = 24000): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : fallback;
}
