import { describe, it, expect } from "vitest";
import { HallucinationFilter } from "./hallucination.filter.js";
import { TranscriptionSegment } from "./transcription-segment.js";

describe("HallucinationFilter", () => {
  const filter = new HallucinationFilter();

  describe("isHallucination", () => {
    it("detects empty text", () => {
      expect(filter.isHallucination("")).toBe(true);
      expect(filter.isHallucination("   ")).toBe(true);
    });

    it("detects known hallucination phrases", () => {
      expect(filter.isHallucination("Спасибо за просмотр!")).toBe(true);
      expect(filter.isHallucination("Подписывайтесь на канал")).toBe(true);
      expect(filter.isHallucination("Thanks for watching")).toBe(true);
    });

    it("detects case-insensitive hallucinations", () => {
      expect(filter.isHallucination("СПАСИБО ЗА ПРОСМОТР")).toBe(true);
      expect(filter.isHallucination("thanks FOR WATCHING")).toBe(true);
    });

    it("detects sound descriptions (all caps)", () => {
      expect(filter.isHallucination("МУЗЫКА")).toBe(true);
      expect(filter.isHallucination("АПЛОДИСМЕНТЫ")).toBe(true);
    });

    it("detects repetitive patterns", () => {
      expect(filter.isHallucination("ха, ха, ха, ха, ха")).toBe(true);
      expect(filter.isHallucination("la la la la la")).toBe(true);
    });

    it("detects foreign scripts (Chinese, Arabic, etc.)", () => {
      expect(filter.isHallucination("这是中文")).toBe(true);
      expect(filter.isHallucination("مرحبا")).toBe(true);
      expect(filter.isHallucination("こんにちは")).toBe(true);
    });

    it("passes normal text", () => {
      expect(filter.isHallucination("Привет, как дела?")).toBe(false);
      expect(filter.isHallucination("Hello, how are you?")).toBe(false);
      expect(filter.isHallucination("Сегодня мы поговорим о TypeScript")).toBe(false);
    });

    it("passes short uppercase words", () => {
      expect(filter.isHallucination("OK")).toBe(false);
      expect(filter.isHallucination("Hi")).toBe(false);
    });
  });

  describe("with custom hallucinations", () => {
    it("uses custom list", () => {
      const custom = new HallucinationFilter(["custom phrase"]);
      expect(custom.isHallucination("This has custom phrase in it")).toBe(true);
      expect(custom.isHallucination("Спасибо за просмотр")).toBe(false);
    });
  });

  describe("filterSegments", () => {
    it("removes hallucination segments", () => {
      const segments = [
        new TranscriptionSegment({ text: "Normal text", startMs: 0, endMs: 1000, confidence: 0.9 }),
        new TranscriptionSegment({ text: "Спасибо за просмотр!", startMs: 1000, endMs: 2000, confidence: 0.8 }),
        new TranscriptionSegment({ text: "More normal text", startMs: 2000, endMs: 3000, confidence: 0.85 }),
      ];

      const filtered = filter.filterSegments(segments);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.text).toBe("Normal text");
      expect(filtered[1]?.text).toBe("More normal text");
    });

    it("returns empty array when all are hallucinations", () => {
      const segments = [
        new TranscriptionSegment({ text: "Thanks for watching", startMs: 0, endMs: 1000, confidence: 0.9 }),
        new TranscriptionSegment({ text: "МУЗЫКА", startMs: 1000, endMs: 2000, confidence: 0.8 }),
      ];

      const filtered = filter.filterSegments(segments);
      expect(filtered).toHaveLength(0);
    });

    it("returns all segments when none are hallucinations", () => {
      const segments = [
        new TranscriptionSegment({ text: "Normal text", startMs: 0, endMs: 1000, confidence: 0.9 }),
        new TranscriptionSegment({ text: "More text", startMs: 1000, endMs: 2000, confidence: 0.8 }),
      ];

      const filtered = filter.filterSegments(segments);
      expect(filtered).toHaveLength(2);
    });
  });
});
