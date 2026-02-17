import { tmpdir } from "node:os";
import { join } from "node:path";
import { PIPELINE_ERROR_CODE, PipelineError } from "../../shared/errors.js";
import { err, ok } from "../../shared/result.js";
import type { Result } from "../../shared/result.js";
import type { ProgressCallback } from "../../shared/types.js";
import type { VideoProviderRegistry } from "../video/video-provider.registry.js";
import type { Transcriber } from "../transcription/transcriber.interface.js";
import type { LlmRouter } from "../llm/llm-router.js";
import type { PromptTemplate } from "../llm/prompts/prompt-template.interface.js";
import { PromptContext } from "../llm/prompts/prompt-context.js";
import { PipelineReport } from "./pipeline-report.js";
import { PIPELINE_STAGE } from "./pipeline-event.js";
import type { FilesystemManager } from "../../infrastructure/filesystem.manager.js";

export interface PipelineOptions {
  readonly url: string;
  readonly whisperModel?: string | undefined;
  readonly language?: string | undefined;
  readonly llmProvider?: string | undefined;
  readonly llmModel?: string | undefined;
  readonly outputPath?: string | undefined;
}

export interface PipelineResult {
  readonly report: PipelineReport;
  readonly outputPath: string;
  readonly totalDurationMs: number;
}

export class PipelineOrchestrator {
  constructor(
    private readonly videoRegistry: VideoProviderRegistry,
    private readonly transcriber: Transcriber,
    private readonly llmRouter: LlmRouter,
    private readonly promptTemplate: PromptTemplate,
    private readonly filesystemManager: FilesystemManager,
  ) {}

  async run(
    options: PipelineOptions,
    onProgress: ProgressCallback,
  ): Promise<Result<PipelineResult, PipelineError>> {
    const startTime = Date.now();

    // Stage 1: Detect provider
    onProgress({ stage: PIPELINE_STAGE.Detect, status: "started" });
    const providerResult = this.videoRegistry.findProvider(options.url);
    if (!providerResult.ok) {
      onProgress({
        stage: PIPELINE_STAGE.Detect,
        status: "failed",
        message: providerResult.error.message,
      });
      return err(
        new PipelineError(
          PIPELINE_ERROR_CODE.StageFailed,
          PIPELINE_STAGE.Detect,
          providerResult.error.message,
          providerResult.error,
        ),
      );
    }
    const videoProvider = providerResult.value;
    onProgress({
      stage: PIPELINE_STAGE.Detect,
      status: "completed",
      message: videoProvider.name,
    });

    // Stage 2: Download
    onProgress({ stage: PIPELINE_STAGE.Download, status: "started" });
    const tempDir = join(tmpdir(), `tolmach-${Date.now()}`);
    await this.filesystemManager.ensureDir(tempDir);

    const downloadResult = await videoProvider.download(options.url, tempDir, (event) => {
      onProgress({ ...event, stage: PIPELINE_STAGE.Download });
    });
    if (!downloadResult.ok) {
      onProgress({
        stage: PIPELINE_STAGE.Download,
        status: "failed",
        message: downloadResult.error.message,
      });
      return err(
        new PipelineError(
          PIPELINE_ERROR_CODE.StageFailed,
          PIPELINE_STAGE.Download,
          downloadResult.error.message,
          downloadResult.error,
        ),
      );
    }
    onProgress({ stage: PIPELINE_STAGE.Download, status: "completed" });
    const downloaded = downloadResult.value;

    // Stage 3: Transcribe
    onProgress({ stage: PIPELINE_STAGE.Transcribe, status: "started" });
    const transcriptionResult = await this.transcriber.transcribe(
      downloaded.audioPath,
      {
        model: options.whisperModel ?? "large-v3-turbo",
        language: options.language ?? "auto",
        outputDir: tempDir,
      },
      (event) => {
        onProgress({ ...event, stage: PIPELINE_STAGE.Transcribe });
      },
    );
    if (!transcriptionResult.ok) {
      onProgress({
        stage: PIPELINE_STAGE.Transcribe,
        status: "failed",
        message: transcriptionResult.error.message,
      });
      return err(
        new PipelineError(
          PIPELINE_ERROR_CODE.StageFailed,
          PIPELINE_STAGE.Transcribe,
          transcriptionResult.error.message,
          transcriptionResult.error,
        ),
      );
    }
    onProgress({ stage: PIPELINE_STAGE.Transcribe, status: "completed" });
    const transcription = transcriptionResult.value;

    // Stage 4: Generate report via LLM
    onProgress({ stage: PIPELINE_STAGE.Report, status: "started" });
    const context = new PromptContext({
      metadata: downloaded.metadata,
      transcription,
    });
    const prompt = this.promptTemplate.render(context);

    const llmResult = await this.llmRouter.complete(prompt, {
      provider: options.llmProvider,
      model: options.llmModel,
    });
    if (!llmResult.ok) {
      onProgress({
        stage: PIPELINE_STAGE.Report,
        status: "failed",
        message: llmResult.error.message,
      });
      return err(
        new PipelineError(
          PIPELINE_ERROR_CODE.StageFailed,
          PIPELINE_STAGE.Report,
          llmResult.error.message,
          llmResult.error,
        ),
      );
    }
    onProgress({ stage: PIPELINE_STAGE.Report, status: "completed" });
    const llmResponse = llmResult.value;

    const report = new PipelineReport({
      content: llmResponse.content,
      metadata: downloaded.metadata,
      llmResponse,
    });

    // Stage 5: Save report
    onProgress({ stage: PIPELINE_STAGE.Save, status: "started" });
    const outputDir = options.outputPath
      ? options.outputPath
      : join(this.filesystemManager.resolvePath("~/.tolmach/reports"));
    await this.filesystemManager.ensureDir(outputDir);

    const outputPath = join(outputDir, report.outputFileName);
    await this.filesystemManager.writeFile(outputPath, report.toMarkdown());
    onProgress({ stage: PIPELINE_STAGE.Save, status: "completed" });

    const totalDurationMs = Date.now() - startTime;

    return ok({ report, outputPath, totalDurationMs });
  }
}
