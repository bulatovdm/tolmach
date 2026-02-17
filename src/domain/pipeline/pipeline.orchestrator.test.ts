/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipelineOrchestrator } from "./pipeline.orchestrator.js";
import { PIPELINE_STAGE } from "./pipeline-event.js";
import { MockLlmProvider } from "../llm/providers/mock.provider.js";
import { LlmRouter } from "../llm/llm-router.js";
import { VideoReportPrompt } from "../llm/prompts/video-report.prompt.js";
import { VideoMetadata } from "../video/video-metadata.js";
import { DownloadedVideo } from "../video/downloaded-video.js";
import { TranscriptionResult } from "../transcription/transcription-result.js";
import { TranscriptionSegment } from "../transcription/transcription-segment.js";
import { ok, err } from "../../shared/result.js";
import { VideoError, VIDEO_ERROR_CODE, TranscriptionError, TRANSCRIPTION_ERROR_CODE } from "../../shared/errors.js";
import type { VideoProviderRegistry } from "../video/video-provider.registry.js";
import type { Transcriber } from "../transcription/transcriber.interface.js";
import type { FilesystemManager } from "../../infrastructure/filesystem.manager.js";
import type { ProgressEvent, ProgressCallback } from "../../shared/types.js";

function createMockMetadata(): VideoMetadata {
  return new VideoMetadata({
    title: "Test Video",
    author: "Author",
    durationSeconds: 60,
    description: "desc",
    url: "https://youtube.com/watch?v=test",
    provider: "youtube",
  });
}

function createMockDownloaded(): DownloadedVideo {
  return new DownloadedVideo({
    audioPath: "/tmp/audio.wav",
    metadata: createMockMetadata(),
    fileSizeBytes: 1024,
  });
}

function createMockTranscription(): TranscriptionResult {
  return new TranscriptionResult({
    segments: [
      new TranscriptionSegment({ text: "Hello world", startMs: 0, endMs: 5000, confidence: 0.95 }),
    ],
    language: "en",
  });
}

describe("PipelineOrchestrator", () => {
  let mockRegistry: VideoProviderRegistry;
  let mockTranscriber: Transcriber;
  let mockFilesystem: FilesystemManager;
  let progressEvents: ProgressEvent[];

  const onProgress: ProgressCallback = (event) => {
    progressEvents.push(event);
  };

  beforeEach(() => {
    progressEvents = [];

    mockRegistry = {
      findProvider: vi.fn().mockReturnValue(
        ok({
          name: "youtube",
          canHandle: () => true,
          download: vi.fn().mockResolvedValue(ok(createMockDownloaded())),
          extractMetadata: vi.fn(),
        }),
      ),
      registeredProviders: [],
    } as unknown as VideoProviderRegistry;

    mockTranscriber = {
      transcribe: vi.fn().mockResolvedValue(ok(createMockTranscription())),
    } as unknown as Transcriber;

    mockFilesystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      removeDir: vi.fn().mockResolvedValue(undefined),
      resolvePath: vi.fn().mockReturnValue("/home/user/.tolmach/reports"),
    } as unknown as FilesystemManager;
  });

  function createOrchestrator(llmResponse = "# Report\n\nGenerated report content") {
    const mockProvider = new MockLlmProvider(llmResponse);
    const router = new LlmRouter([mockProvider]);
    const prompt = new VideoReportPrompt();

    return new PipelineOrchestrator(
      mockRegistry,
      mockTranscriber,
      router,
      prompt,
      mockFilesystem,
    );
  }

  it("runs full pipeline successfully", async () => {
    const orchestrator = createOrchestrator();

    const result = await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.report.content).toContain("Report");
      expect(result.value.outputPath).toContain(".md");
      expect(result.value.totalDurationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("emits progress events for all stages", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    const stages = progressEvents.map((e) => e.stage);
    expect(stages).toContain(PIPELINE_STAGE.Detect);
    expect(stages).toContain(PIPELINE_STAGE.Download);
    expect(stages).toContain(PIPELINE_STAGE.Transcribe);
    expect(stages).toContain(PIPELINE_STAGE.Report);
    expect(stages).toContain(PIPELINE_STAGE.Save);
  });

  it("emits started and completed for each stage", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    for (const stage of [PIPELINE_STAGE.Detect, PIPELINE_STAGE.Download, PIPELINE_STAGE.Transcribe, PIPELINE_STAGE.Report, PIPELINE_STAGE.Save]) {
      const stageEvents = progressEvents.filter((e) => e.stage === stage);
      expect(stageEvents.some((e) => e.status === "started")).toBe(true);
      expect(stageEvents.some((e) => e.status === "completed")).toBe(true);
    }
  });

  it("fails at detect stage", async () => {
    vi.mocked(mockRegistry.findProvider).mockReturnValue(
      err(new VideoError(VIDEO_ERROR_CODE.ProviderNotFound, "No provider")),
    );

    const orchestrator = createOrchestrator();
    const result = await orchestrator.run(
      { url: "https://unknown.com/video" },
      onProgress,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stageName).toBe(PIPELINE_STAGE.Detect);
    }

    const failEvent = progressEvents.find(
      (e) => e.stage === PIPELINE_STAGE.Detect && e.status === "failed",
    );
    expect(failEvent).toBeDefined();
  });

  it("fails at download stage", async () => {
    const provider = {
      name: "youtube",
      canHandle: () => true,
      download: vi.fn().mockResolvedValue(
        err(new VideoError(VIDEO_ERROR_CODE.DownloadFailed, "Download error")),
      ),
      extractMetadata: vi.fn(),
    };
    vi.mocked(mockRegistry.findProvider).mockReturnValue(ok(provider));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stageName).toBe(PIPELINE_STAGE.Download);
    }
  });

  it("fails at transcribe stage", async () => {
    vi.mocked(mockTranscriber.transcribe).mockResolvedValue(
      err(new TranscriptionError(TRANSCRIPTION_ERROR_CODE.TranscriptionFailed, "Whisper error")),
    );

    const orchestrator = createOrchestrator();
    const result = await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stageName).toBe(PIPELINE_STAGE.Transcribe);
    }
  });

  it("saves report to custom output path", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test", outputPath: "/custom/output" },
      onProgress,
    );

    expect(mockFilesystem.ensureDir).toHaveBeenCalledWith("/custom/output");
    expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("/custom/output/"),
      expect.stringContaining("Test Video"),
    );
  });

  it("saves report to default path when no output specified", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test" },
      onProgress,
    );

    expect(mockFilesystem.resolvePath).toHaveBeenCalledWith("~/.tolmach/reports");
  });

  it("passes whisper model option", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test", whisperModel: "tiny" },
      onProgress,
    );

    expect(mockTranscriber.transcribe).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: "tiny" }),
      expect.any(Function),
    );
  });

  it("passes language option", async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.run(
      { url: "https://youtube.com/watch?v=test", language: "ru" },
      onProgress,
    );

    expect(mockTranscriber.transcribe).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ language: "ru" }),
      expect.any(Function),
    );
  });
});
