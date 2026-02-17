import { join, basename, isAbsolute } from "node:path";
import { type Result, ok, err } from "../../shared/result.js";
import { TranscriptionError, TRANSCRIPTION_ERROR_CODE } from "../../shared/errors.js";
import type { ProgressCallback } from "../../shared/types.js";
import type { ProcessRunner } from "../../infrastructure/process.runner.js";
import type { FilesystemManager } from "../../infrastructure/filesystem.manager.js";
import type { Transcriber, TranscriptionOptions } from "./transcriber.interface.js";
import { TranscriptionResult } from "./transcription-result.js";
import type { WhisperOutputParser } from "./whisper-output.parser.js";
import type { HallucinationFilter } from "./hallucination.filter.js";

const WHISPER_PROGRESS_PATTERN = /progress\s*=?\s*(\d+)%/;

export class WhisperTranscriber implements Transcriber {
  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly filesystemManager: FilesystemManager,
    private readonly outputParser: WhisperOutputParser,
    private readonly hallucinationFilter: HallucinationFilter,
    private readonly whisperBinary: string = "whisper-cli",
  ) {}

  async transcribe(
    audioPath: string,
    options: TranscriptionOptions,
    onProgress: ProgressCallback,
  ): Promise<Result<TranscriptionResult, TranscriptionError>> {
    const outputPrefix = join(
      options.outputDir,
      basename(audioPath, ".wav"),
    );

    const args = this.buildArgs(audioPath, options, outputPrefix);

    const processResult = await this.processRunner.runWithProgress(
      this.whisperBinary,
      args,
      (line) => {
        const match = WHISPER_PROGRESS_PATTERN.exec(line);
        return match?.[1] !== undefined ? parseInt(match[1], 10) : undefined;
      },
      onProgress,
    );

    if (!processResult.ok) {
      return err(
        new TranscriptionError(
          TRANSCRIPTION_ERROR_CODE.TranscriptionFailed,
          `Whisper failed: ${processResult.error.message}`,
          processResult.error,
        ),
      );
    }

    const jsonPath = `${outputPrefix}.json`;
    const jsonExists = await this.filesystemManager.exists(jsonPath);
    if (!jsonExists) {
      return err(
        new TranscriptionError(
          TRANSCRIPTION_ERROR_CODE.ParseFailed,
          `Whisper output file not found: ${jsonPath}`,
        ),
      );
    }

    const fileResult = await this.filesystemManager.readFile(jsonPath);
    if (!fileResult.ok) {
      return err(
        new TranscriptionError(
          TRANSCRIPTION_ERROR_CODE.ParseFailed,
          `Failed to read whisper output: ${fileResult.error.message}`,
          fileResult.error,
        ),
      );
    }

    const parseResult = this.outputParser.parse(fileResult.value);
    if (!parseResult.ok) {
      return parseResult;
    }

    const filteredSegments = this.hallucinationFilter.filterSegments(
      parseResult.value.segments,
    );

    return ok(
      new TranscriptionResult({
        segments: filteredSegments,
        language: parseResult.value.language,
      }),
    );
  }

  private buildArgs(
    audioPath: string,
    options: TranscriptionOptions,
    outputPrefix: string,
  ): readonly string[] {
    const args: string[] = ["-f", audioPath, "--output-json-full", "-pp", "-of", outputPrefix];

    if (options.model) {
      const modelPath = this.resolveModelPath(options.model, options.modelDir);
      args.push("-m", modelPath);
    }

    if (options.language && options.language !== "auto") {
      args.push("-l", options.language);
    }

    return args;
  }

  private resolveModelPath(model: string, modelDir?: string): string {
    if (isAbsolute(model) || model.endsWith(".bin")) {
      return model;
    }

    const dir = modelDir ?? "~/.tolmach/models";
    return join(dir, `ggml-${model}.bin`);
  }
}
