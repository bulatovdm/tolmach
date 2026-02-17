import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProcessRunner } from "../../infrastructure/process.runner.js";
import { FilesystemManager } from "../../infrastructure/filesystem.manager.js";
import { VideoProviderRegistry } from "../../domain/video/video-provider.registry.js";
import { YouTubeProvider } from "../../domain/video/providers/youtube.provider.js";
import { WhisperTranscriber } from "../../domain/transcription/whisper.transcriber.js";
import { WhisperOutputParser } from "../../domain/transcription/whisper-output.parser.js";
import { HallucinationFilter } from "../../domain/transcription/hallucination.filter.js";
import { LlmRouter } from "../../domain/llm/llm-router.js";
import { ClaudeAgentProvider } from "../../domain/llm/providers/claude-agent.provider.js";
import { MockLlmProvider } from "../../domain/llm/providers/mock.provider.js";
import { VideoReportPrompt } from "../../domain/llm/prompts/video-report.prompt.js";
import { PipelineOrchestrator } from "../../domain/pipeline/pipeline.orchestrator.js";
import { PIPELINE_STAGE } from "../../domain/pipeline/pipeline-event.js";
import { ProgressDisplay } from "../ui/progress.display.js";

export interface TranscribeOptions {
  readonly provider?: string | undefined;
  readonly model?: string | undefined;
  readonly output?: string | undefined;
  readonly lang?: string | undefined;
  readonly llmProvider?: string | undefined;
  readonly noLlm?: boolean | undefined;
}

export async function transcribeCommand(url: string, options: TranscribeOptions): Promise<void> {
  const display = new ProgressDisplay();
  const processRunner = new ProcessRunner();
  const filesystemManager = new FilesystemManager();

  const registry = new VideoProviderRegistry([
    new YouTubeProvider(processRunner, filesystemManager),
  ]);

  const transcriber = new WhisperTranscriber(
    processRunner,
    filesystemManager,
    new WhisperOutputParser(),
    new HallucinationFilter(),
  );

  // If --no-llm, run transcription-only pipeline (backward compat)
  if (options.noLlm) {
    await runTranscriptionOnly(url, options, display, registry, transcriber, filesystemManager);
    return;
  }

  // Full pipeline with LLM
  const llmProviders = [
    new ClaudeAgentProvider(),
    new MockLlmProvider(),
  ];

  const llmRouter = new LlmRouter(llmProviders, options.llmProvider ?? "claude-agent");
  const promptTemplate = new VideoReportPrompt();

  const orchestrator = new PipelineOrchestrator(
    registry,
    transcriber,
    llmRouter,
    promptTemplate,
    filesystemManager,
  );

  const result = await orchestrator.run(
    {
      url,
      whisperModel: options.model,
      language: options.lang,
      llmProvider: options.llmProvider,
      outputPath: options.output,
    },
    (event) => { display.handleProgress(event); },
  );

  if (!result.ok) {
    display.showError(result.error.message);
    process.exitCode = 1;
    return;
  }

  const { report, outputPath, totalDurationMs } = result.value;

  display.showSummary({
    totalDurationMs,
    videoDuration: report.metadata.formattedDuration,
    model: report.llmResponse.model,
    outputPath,
  });
}

async function runTranscriptionOnly(
  url: string,
  options: TranscribeOptions,
  display: ProgressDisplay,
  registry: VideoProviderRegistry,
  transcriber: WhisperTranscriber,
  filesystemManager: FilesystemManager,
): Promise<void> {
  const startTime = Date.now();

  display.handleProgress({ stage: PIPELINE_STAGE.Detect, status: "started" });
  const providerResult = registry.findProvider(url);
  if (!providerResult.ok) {
    display.handleProgress({
      stage: PIPELINE_STAGE.Detect,
      status: "failed",
      message: providerResult.error.message,
    });
    process.exitCode = 1;
    return;
  }
  const videoProvider = providerResult.value;
  display.handleProgress({
    stage: PIPELINE_STAGE.Detect,
    status: "completed",
    message: videoProvider.name,
  });

  display.handleProgress({ stage: PIPELINE_STAGE.Download, status: "started" });
  const tempDir = join(tmpdir(), `tolmach-${Date.now()}`);
  await filesystemManager.ensureDir(tempDir);

  const downloadResult = await videoProvider.download(url, tempDir, (event) => {
    display.handleProgress({ ...event, stage: PIPELINE_STAGE.Download });
  });
  if (!downloadResult.ok) {
    display.handleProgress({
      stage: PIPELINE_STAGE.Download,
      status: "failed",
      message: downloadResult.error.message,
    });
    process.exitCode = 1;
    return;
  }
  display.handleProgress({ stage: PIPELINE_STAGE.Download, status: "completed" });

  const downloaded = downloadResult.value;

  display.handleProgress({ stage: PIPELINE_STAGE.Transcribe, status: "started" });
  const transcriptionResult = await transcriber.transcribe(
    downloaded.audioPath,
    {
      model: options.model ?? "large-v3-turbo",
      language: options.lang ?? "auto",
      outputDir: tempDir,
    },
    (event) => {
      display.handleProgress({ ...event, stage: PIPELINE_STAGE.Transcribe });
    },
  );
  if (!transcriptionResult.ok) {
    display.handleProgress({
      stage: PIPELINE_STAGE.Transcribe,
      status: "failed",
      message: transcriptionResult.error.message,
    });
    process.exitCode = 1;
    return;
  }
  display.handleProgress({ stage: PIPELINE_STAGE.Transcribe, status: "completed" });

  const transcription = transcriptionResult.value;

  console.log(`\nТранскрипция (${transcription.language}, ${transcription.segments.length} сегментов):\n`);
  console.log(transcription.fullText);

  const totalDuration = Date.now() - startTime;
  display.showSummary({
    totalDurationMs: totalDuration,
    videoDuration: downloaded.metadata.formattedDuration,
    model: options.model ?? "large-v3-turbo",
    outputPath: "(LLM не подключён — только транскрипция)",
  });
}
