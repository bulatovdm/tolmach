import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProcessRunner } from "../../infrastructure/process.runner.js";
import { FilesystemManager } from "../../infrastructure/filesystem.manager.js";
import { ConfigManager } from "../../infrastructure/config.manager.js";
import { CacheManager } from "../../infrastructure/cache.manager.js";
import { DependencyChecker } from "../../infrastructure/dependency.checker.js";
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
import type { TolmachConfig } from "../../config/default.config.js";

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

  const configManager = new ConfigManager(filesystemManager);
  const config = await configManager.load({
    llmProvider: options.llmProvider ?? options.provider,
    whisperModel: options.model,
    language: options.lang,
    outputDir: options.output,
  });

  const modelDir = filesystemManager.resolvePath(config.whisper.modelDir);
  const modelPath = `${modelDir}/ggml-${config.whisper.model}.bin`;
  const depChecker = new DependencyChecker(processRunner, filesystemManager);
  try {
    await depChecker.ensureRequired(modelPath);
  } catch (error) {
    display.showError((error as Error).message);
    process.exitCode = 1;
    return;
  }

  const registry = new VideoProviderRegistry([
    new YouTubeProvider(processRunner, filesystemManager),
  ]);

  const transcriber = new WhisperTranscriber(
    processRunner,
    filesystemManager,
    new WhisperOutputParser(),
    new HallucinationFilter(),
  );

  const cacheManager = config.cache.enabled
    ? new CacheManager(filesystemManager, filesystemManager.resolvePath(config.cache.dir))
    : undefined;

  if (options.noLlm) {
    await runTranscriptionOnly(url, config, display, registry, transcriber, filesystemManager, cacheManager);
    return;
  }

  const llmProviders = [
    new ClaudeAgentProvider(),
    new MockLlmProvider(),
  ];

  const llmRouter = new LlmRouter(llmProviders, config.llm.provider);
  const promptTemplate = new VideoReportPrompt();

  const orchestrator = new PipelineOrchestrator(
    registry,
    transcriber,
    llmRouter,
    promptTemplate,
    filesystemManager,
    cacheManager,
  );

  const result = await orchestrator.run(
    {
      url,
      whisperModel: config.whisper.model,
      whisperModelDir: filesystemManager.resolvePath(config.whisper.modelDir),
      language: config.whisper.language,
      llmProvider: config.llm.provider,
      reportLanguage: config.llm.reportLanguage,
      outputDir: config.output.dir,
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
  config: TolmachConfig,
  display: ProgressDisplay,
  registry: VideoProviderRegistry,
  transcriber: WhisperTranscriber,
  filesystemManager: FilesystemManager,
  cacheManager?: CacheManager,
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
  const whisperModel = config.whisper.model;

  display.handleProgress({ stage: PIPELINE_STAGE.Transcribe, status: "started" });
  const cached = await cacheManager?.get(downloaded.audioPath, whisperModel);

  let transcription;
  if (cached) {
    display.handleProgress({ stage: PIPELINE_STAGE.Transcribe, status: "completed", message: "из кэша" });
    transcription = cached;
  } else {
    const transcriptionResult = await transcriber.transcribe(
      downloaded.audioPath,
      {
        model: whisperModel,
        language: config.whisper.language,
        outputDir: tempDir,
        modelDir: filesystemManager.resolvePath(config.whisper.modelDir),
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
    transcription = transcriptionResult.value;

    await cacheManager?.set(downloaded.audioPath, whisperModel, transcription);
  }

  display.handleProgress({ stage: PIPELINE_STAGE.Save, status: "started" });
  const outputDir = filesystemManager.resolvePath(config.output.dir);
  await filesystemManager.ensureDir(outputDir);

  const slug = downloaded.metadata.title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const date = new Date().toISOString().split("T")[0];
  const outputPath = join(outputDir, `${date}-${slug}.txt`);

  const header = `Транскрипция: ${downloaded.metadata.title}\nАвтор: ${downloaded.metadata.author}\nДлительность: ${downloaded.metadata.formattedDuration}\nЯзык: ${transcription.language}\nСегментов: ${transcription.segments.length}\n\n---\n\n`;
  await filesystemManager.writeFile(outputPath, header + transcription.fullText);
  display.handleProgress({ stage: PIPELINE_STAGE.Save, status: "completed" });

  await filesystemManager.removeDir(tempDir);

  const totalDuration = Date.now() - startTime;
  display.showSummary({
    totalDurationMs: totalDuration,
    videoDuration: downloaded.metadata.formattedDuration,
    model: whisperModel,
    outputPath,
  });
}
