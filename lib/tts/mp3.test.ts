import { describe, expect, it } from "vitest";

import { encodeMp3, rateFromMime } from "./mp3";

describe("encodeMp3", () => {
  it("encodes a one-second tone into mp3 frames", () => {
    const rate = 24000;
    const tone = Int16Array.from({ length: rate }, (_, i) => Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000));
    const mp3 = encodeMp3(tone, rate);
    expect(mp3.length).toBeGreaterThan(1000);
    // MPEG audio frame sync: 11 set bits.
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
  });
});

describe("rateFromMime", () => {
  it("reads the rate or falls back to 24 kHz", () => {
    expect(rateFromMime("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(rateFromMime("audio/wav")).toBe(24000);
  });
});
