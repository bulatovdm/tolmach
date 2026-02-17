import type { Result } from "../../shared/result.js";
import type { TranscriptionError } from "../../shared/errors.js";
import type { ProgressCallback } from "../../shared/types.js";
import type { TranscriptionResult } from "./transcription-result.js";

export interface TranscriptionOptions {
  readonly model: string;
  readonly language: string;
  readonly outputDir: string;
  readonly modelDir?: string | undefined;
}

export interface Transcriber {
  transcribe(
    audioPath: string,
    options: TranscriptionOptions,
    onProgress: ProgressCallback,
  ): Promise<Result<TranscriptionResult, TranscriptionError>>;
}
