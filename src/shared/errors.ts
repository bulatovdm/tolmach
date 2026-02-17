export const VIDEO_ERROR_CODE = {
  ProviderNotFound: "VIDEO_PROVIDER_NOT_FOUND",
  DownloadFailed: "VIDEO_DOWNLOAD_FAILED",
  MetadataFailed: "VIDEO_METADATA_FAILED",
  InvalidUrl: "VIDEO_INVALID_URL",
} as const;

export type VideoErrorCode = (typeof VIDEO_ERROR_CODE)[keyof typeof VIDEO_ERROR_CODE];

export const TRANSCRIPTION_ERROR_CODE = {
  WhisperNotFound: "TRANSCRIPTION_WHISPER_NOT_FOUND",
  TranscriptionFailed: "TRANSCRIPTION_FAILED",
  InvalidAudio: "TRANSCRIPTION_INVALID_AUDIO",
  ParseFailed: "TRANSCRIPTION_PARSE_FAILED",
} as const;

export type TranscriptionErrorCode =
  (typeof TRANSCRIPTION_ERROR_CODE)[keyof typeof TRANSCRIPTION_ERROR_CODE];

export const LLM_ERROR_CODE = {
  ProviderNotFound: "LLM_PROVIDER_NOT_FOUND",
  CompletionFailed: "LLM_COMPLETION_FAILED",
  EmptyResponse: "LLM_EMPTY_RESPONSE",
  Timeout: "LLM_TIMEOUT",
} as const;

export type LlmErrorCode = (typeof LLM_ERROR_CODE)[keyof typeof LLM_ERROR_CODE];

export const PIPELINE_ERROR_CODE = {
  StageFailed: "PIPELINE_STAGE_FAILED",
  Aborted: "PIPELINE_ABORTED",
} as const;

export type PipelineErrorCode = (typeof PIPELINE_ERROR_CODE)[keyof typeof PIPELINE_ERROR_CODE];

export abstract class TolmachError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class VideoError extends TolmachError {
  constructor(
    readonly code: VideoErrorCode,
    message: string,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

export class TranscriptionError extends TolmachError {
  constructor(
    readonly code: TranscriptionErrorCode,
    message: string,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

export class LlmError extends TolmachError {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

export class PipelineError extends TolmachError {
  constructor(
    readonly code: PipelineErrorCode,
    readonly stageName: string,
    message: string,
    cause?: Error,
  ) {
    super(message, cause);
  }
}
