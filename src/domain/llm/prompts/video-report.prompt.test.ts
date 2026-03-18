import { describe, it, expect } from "vitest";
import { VideoReportPrompt } from "./video-report.prompt.js";
import { PromptContext } from "./prompt-context.js";
import { VideoMetadata } from "../../video/video-metadata.js";
import { TranscriptionResult } from "../../transcription/transcription-result.js";
import { TranscriptionSegment } from "../../transcription/transcription-segment.js";

describe("VideoReportPrompt", () => {
  const prompt = new VideoReportPrompt();

  function createContext(durationSeconds = 120): PromptContext {
    const metadata = new VideoMetadata({
      title: "Test Video",
      author: "Author",
      durationSeconds,
      description: "A test video",
      url: "https://youtube.com/watch?v=123",
      provider: "youtube",
    });

    const segments = [
      new TranscriptionSegment({ text: "Hello world", startMs: 0, endMs: 5000, confidence: 0.95 }),
      new TranscriptionSegment({ text: "This is a test", startMs: 5000, endMs: 10000, confidence: 0.9 }),
    ];

    const transcription = new TranscriptionResult({
      segments,
      language: "en",
    });

    return new PromptContext({ metadata, transcription });
  }

  it("has correct name", () => {
    expect(prompt.name).toBe("video-report");
  });

  it("renders prompt with metadata", () => {
    const rendered = prompt.render(createContext());
    expect(rendered).toContain("Test Video");
    expect(rendered).toContain("Author");
    expect(rendered).toContain("2:00");
    expect(rendered).toContain("https://youtube.com/watch?v=123");
  });

  it("renders prompt with transcription text", () => {
    const rendered = prompt.render(createContext());
    expect(rendered).toContain("Hello world");
    expect(rendered).toContain("This is a test");
  });

  it("includes language and confidence", () => {
    const rendered = prompt.render(createContext());
    expect(rendered).toContain("en");
    expect(rendered).toMatch(/\d+%/);
  });

  it("includes report structure instructions", () => {
    const rendered = prompt.render(createContext());
    expect(rendered).toContain("Краткое содержание");
    expect(rendered).toContain("Ключевые темы");
    expect(rendered).toContain("Основные тезисы");
    expect(rendered).toContain("Цитаты");
    expect(rendered).toContain("Заключение");
  });

  it("uses short scale for videos under 15 minutes", () => {
    const rendered = prompt.render(createContext(600));
    expect(rendered).toContain("3–5 предложений");
    expect(rendered).toContain("3–5 наиболее значимых цитат");
    expect(rendered).toContain("Пиши ёмко, но информативно.");
  });

  it("uses medium scale for videos between 15 and 45 minutes", () => {
    const rendered = prompt.render(createContext(1800));
    expect(rendered).toContain("5–8 предложений");
    expect(rendered).toContain("5–8 наиболее значимых цитат");
    expect(rendered).toContain("8–15 тезисов");
    expect(rendered).toContain("раскрой каждую тему 1–2 предложениями");
    expect(rendered).toContain("Видео средней длительности");
  });

  it("uses long scale for videos over 45 minutes", () => {
    const rendered = prompt.render(createContext(3600));
    expect(rendered).toContain("8–12 предложений");
    expect(rendered).toContain("8–12 наиболее значимых цитат");
    expect(rendered).toContain("15–25 тезисов");
    expect(rendered).toContain("раскрой каждую тему 2–3 предложениями");
    expect(rendered).toContain("Это длинное видео");
  });

  it("treats boundary at 15 minutes as medium", () => {
    const rendered = prompt.render(createContext(901));
    expect(rendered).toContain("5–8 предложений");
  });

  it("treats boundary at 45 minutes as long", () => {
    const rendered = prompt.render(createContext(2701));
    expect(rendered).toContain("8–12 предложений");
  });
});
