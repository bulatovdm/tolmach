import { describe, it, expect } from "vitest";
import { PipelineReport } from "./pipeline-report.js";
import { VideoMetadata } from "../video/video-metadata.js";
import { LlmResponse } from "../llm/llm-response.js";

describe("PipelineReport", () => {
  function createReport(content = "# Report content") {
    const metadata = new VideoMetadata({
      title: "Test Video Title",
      author: "Test Author",
      durationSeconds: 360,
      description: "desc",
      url: "https://youtube.com/watch?v=abc",
      provider: "youtube",
    });

    const llmResponse = new LlmResponse({
      content,
      model: "claude-sonnet-4-5",
      provider: "claude-agent",
      inputTokens: 500,
      outputTokens: 200,
      costUsd: 0.003,
      durationMs: 2000,
    });

    return new PipelineReport({ content, metadata, llmResponse });
  }

  it("creates report with all fields", () => {
    const report = createReport();
    expect(report.content).toBe("# Report content");
    expect(report.metadata.title).toBe("Test Video Title");
    expect(report.llmResponse.model).toBe("claude-sonnet-4-5");
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it("generates markdown with header", () => {
    const report = createReport("Some content");
    const md = report.toMarkdown();

    expect(md).toContain("# Test Video Title");
    expect(md).toContain("Test Author");
    expect(md).toContain("6:00");
    expect(md).toContain("https://youtube.com/watch?v=abc");
    expect(md).toContain("claude-sonnet-4-5");
    expect(md).toContain("Some content");
  });

  it("generates slug-based output filename", () => {
    const report = createReport();
    const filename = report.outputFileName;

    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-test-video-title\.md$/);
  });

  it("handles special characters in filename", () => {
    const metadata = new VideoMetadata({
      title: "Видео: тест! @#$ (часть 1)",
      author: "Author",
      durationSeconds: 60,
      description: "desc",
      url: "https://youtube.com/watch?v=x",
      provider: "youtube",
    });

    const llmResponse = new LlmResponse({
      content: "content",
      model: "model",
      provider: "provider",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
    });

    const report = new PipelineReport({ content: "content", metadata, llmResponse });
    expect(report.outputFileName).not.toContain("!");
    expect(report.outputFileName).not.toContain("@");
    expect(report.outputFileName).not.toContain("#");
    expect(report.outputFileName).toMatch(/\.md$/);
  });

  it("truncates long filenames", () => {
    const metadata = new VideoMetadata({
      title: "A".repeat(200),
      author: "Author",
      durationSeconds: 60,
      description: "desc",
      url: "https://youtube.com/watch?v=x",
      provider: "youtube",
    });

    const llmResponse = new LlmResponse({
      content: "content",
      model: "model",
      provider: "provider",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
    });

    const report = new PipelineReport({ content: "content", metadata, llmResponse });
    // date (10) + dash (1) + slug (<=80) + .md (3) = max 94
    expect(report.outputFileName.length).toBeLessThanOrEqual(94);
  });
});
