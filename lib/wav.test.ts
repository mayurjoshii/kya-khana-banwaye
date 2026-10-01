import { describe, expect, it } from "vitest";

import { decodeWav, encodeWav, floatTo16, isWav } from "./wav";

describe("wav", () => {
  it("round-trips 16-bit mono samples", () => {
    const samples = Int16Array.from([0, 1000, -1000, 32767, -32768]);
    const bytes = encodeWav(samples, 24000);
    expect(isWav(bytes)).toBe(true);
    const decoded = decodeWav(bytes);
    expect(decoded.sampleRate).toBe(24000);
    expect(decoded.channels).toBe(1);
    expect(Array.from(decoded.samples)).toEqual(Array.from(samples));
  });

  it("clamps floats when converting", () => {
    expect(Array.from(floatTo16(Float32Array.from([2, -2, 0])))).toEqual([32767, -32768, 0]);
  });

  it("recognises raw PCM as not WAV", () => {
    expect(isWav(new Uint8Array(100))).toBe(false);
  });
});
