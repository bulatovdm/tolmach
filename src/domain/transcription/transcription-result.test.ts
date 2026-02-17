import { describe, it, expect } from "vitest";
import { TranscriptionResult } from "./transcription-result.js";
import { TranscriptionSegment } from "./transcription-segment.js";

describe("TranscriptionResult", () => {
  const segment1 = new TranscriptionSegment({
    text: "Hello world",
    startMs: 0,
    endMs: 2000,
    confidence: 0.9,
  });

  const segment2 = new TranscriptionSegment({
    text: "How are you",
    startMs: 2000,
    endMs: 4000,
    confidence: 0.8,
  });

  it("creates with segments and language", () => {
    const result = new TranscriptionResult({
      segments: [segment1, segment2],
      language: "en",
    });
    expect(result.language).toBe("en");
    expect(result.segments).toHaveLength(2);
  });

  it("computes full text from segments", () => {
    const result = new TranscriptionResult({
      segments: [segment1, segment2],
      language: "en",
    });
    expect(result.fullText).toBe("Hello world How are you");
  });

  it("computes duration from last segment", () => {
    const result = new TranscriptionResult({
      segments: [segment1, segment2],
      language: "en",
    });
    expect(result.durationMs).toBe(4000);
  });

  it("computes weighted average confidence", () => {
    const result = new TranscriptionResult({
      segments: [segment1, segment2],
      language: "en",
    });
    expect(result.averageConfidence).toBeCloseTo(0.85, 2);
  });

  it("handles empty segments", () => {
    const result = new TranscriptionResult({
      segments: [],
      language: "en",
    });
    expect(result.fullText).toBe("");
    expect(result.durationMs).toBe(0);
    expect(result.averageConfidence).toBe(0);
  });

  it("handles single segment", () => {
    const result = new TranscriptionResult({
      segments: [segment1],
      language: "ru",
    });
    expect(result.fullText).toBe("Hello world");
    expect(result.durationMs).toBe(2000);
    expect(result.averageConfidence).toBeCloseTo(0.9, 2);
  });
});
