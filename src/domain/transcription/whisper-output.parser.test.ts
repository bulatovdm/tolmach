import { describe, it, expect } from "vitest";
import { WhisperOutputParser } from "./whisper-output.parser.js";

const VALID_WHISPER_OUTPUT = JSON.stringify({
  transcription: [
    {
      timestamps: { from: "00:00:00,720", to: "00:00:08,880" },
      offsets: { from: 720, to: 8880 },
      text: " Hello world, this is a test.",
      tokens: [
        { text: " Hello", p: 0.95, timestamps: { from: "00:00:00,720", to: "00:00:01,000" }, offsets: { from: 720, to: 1000 } },
        { text: " world", p: 0.92, timestamps: { from: "00:00:01,000", to: "00:00:02,000" }, offsets: { from: 1000, to: 2000 } },
        { text: ",", p: 0.88 },
        { text: " this", p: 0.90 },
        { text: " is", p: 0.93 },
        { text: " a", p: 0.91 },
        { text: " test", p: 0.89 },
        { text: ".", p: 0.87 },
      ],
    },
    {
      timestamps: { from: "00:00:09,000", to: "00:00:15,000" },
      offsets: { from: 9000, to: 15000 },
      text: " Second segment here.",
      tokens: [
        { text: " Second", p: 0.85 },
        { text: " segment", p: 0.82 },
        { text: " here", p: 0.80 },
        { text: ".", p: 0.78 },
      ],
    },
  ],
  result: { language: "en" },
});

const MINIMAL_WHISPER_OUTPUT = JSON.stringify({
  transcription: [
    {
      timestamps: { from: "00:00:00,000", to: "00:00:05,000" },
      offsets: { from: 0, to: 5000 },
      text: " Simple text.",
    },
  ],
});

describe("WhisperOutputParser", () => {
  const parser = new WhisperOutputParser();

  describe("parse", () => {
    it("parses valid whisper output with tokens", () => {
      const result = parser.parse(VALID_WHISPER_OUTPUT);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.segments).toHaveLength(2);
        expect(result.value.language).toBe("en");
        expect(result.value.segments[0]?.text).toBe("Hello world, this is a test.");
        expect(result.value.segments[0]?.startMs).toBe(720);
        expect(result.value.segments[0]?.endMs).toBe(8880);
        expect(result.value.segments[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it("parses minimal output without tokens", () => {
      const result = parser.parse(MINIMAL_WHISPER_OUTPUT);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.segments).toHaveLength(1);
        expect(result.value.segments[0]?.text).toBe("Simple text.");
        expect(result.value.segments[0]?.confidence).toBe(0);
        expect(result.value.language).toBe("unknown");
      }
    });

    it("calculates segment confidence from tokens", () => {
      const result = parser.parse(VALID_WHISPER_OUTPUT);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const confidence = result.value.segments[0]?.confidence ?? 0;
        expect(confidence).toBeGreaterThan(0.85);
        expect(confidence).toBeLessThan(1.0);
      }
    });

    it("returns error for invalid JSON", () => {
      const result = parser.parse("not json");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("TRANSCRIPTION_PARSE_FAILED");
      }
    });

    it("returns error for invalid structure", () => {
      const result = parser.parse(JSON.stringify({ foo: "bar" }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("TRANSCRIPTION_PARSE_FAILED");
      }
    });

    it("trims segment text", () => {
      const result = parser.parse(VALID_WHISPER_OUTPUT);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.segments[0]?.text).not.toMatch(/^\s/);
      }
    });
  });
});
