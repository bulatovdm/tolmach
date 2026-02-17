import { describe, it, expect } from "vitest";
import {
  VideoError,
  TranscriptionError,
  LlmError,
  PipelineError,
  VIDEO_ERROR_CODE,
  TRANSCRIPTION_ERROR_CODE,
  LLM_ERROR_CODE,
  PIPELINE_ERROR_CODE,
  TolmachError,
} from "./errors.js";

describe("Error hierarchy", () => {
  describe("VideoError", () => {
    it("creates with code and message", () => {
      const error = new VideoError(VIDEO_ERROR_CODE.ProviderNotFound, "No provider for URL");
      expect(error.code).toBe("VIDEO_PROVIDER_NOT_FOUND");
      expect(error.message).toBe("No provider for URL");
      expect(error.name).toBe("VideoError");
      expect(error).toBeInstanceOf(TolmachError);
      expect(error).toBeInstanceOf(Error);
    });

    it("preserves cause", () => {
      const cause = new Error("original");
      const error = new VideoError(VIDEO_ERROR_CODE.DownloadFailed, "Download failed", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("TranscriptionError", () => {
    it("creates with code and message", () => {
      const error = new TranscriptionError(
        TRANSCRIPTION_ERROR_CODE.WhisperNotFound,
        "whisper-cli not found",
      );
      expect(error.code).toBe("TRANSCRIPTION_WHISPER_NOT_FOUND");
      expect(error.name).toBe("TranscriptionError");
      expect(error).toBeInstanceOf(TolmachError);
    });
  });

  describe("LlmError", () => {
    it("creates with code and message", () => {
      const error = new LlmError(LLM_ERROR_CODE.CompletionFailed, "API error");
      expect(error.code).toBe("LLM_COMPLETION_FAILED");
      expect(error.name).toBe("LlmError");
      expect(error).toBeInstanceOf(TolmachError);
    });
  });

  describe("PipelineError", () => {
    it("creates with code, stage name, and message", () => {
      const error = new PipelineError(
        PIPELINE_ERROR_CODE.StageFailed,
        "download",
        "Stage download failed",
      );
      expect(error.code).toBe("PIPELINE_STAGE_FAILED");
      expect(error.stageName).toBe("download");
      expect(error.message).toBe("Stage download failed");
      expect(error.name).toBe("PipelineError");
      expect(error).toBeInstanceOf(TolmachError);
    });

    it("preserves cause from upstream error", () => {
      const cause = new VideoError(VIDEO_ERROR_CODE.DownloadFailed, "timeout");
      const error = new PipelineError(
        PIPELINE_ERROR_CODE.StageFailed,
        "download",
        "Stage failed",
        cause,
      );
      expect(error.cause).toBe(cause);
    });
  });

  describe("Error codes", () => {
    it("has all video error codes", () => {
      expect(VIDEO_ERROR_CODE.ProviderNotFound).toBe("VIDEO_PROVIDER_NOT_FOUND");
      expect(VIDEO_ERROR_CODE.DownloadFailed).toBe("VIDEO_DOWNLOAD_FAILED");
      expect(VIDEO_ERROR_CODE.MetadataFailed).toBe("VIDEO_METADATA_FAILED");
      expect(VIDEO_ERROR_CODE.InvalidUrl).toBe("VIDEO_INVALID_URL");
    });

    it("has all transcription error codes", () => {
      expect(TRANSCRIPTION_ERROR_CODE.WhisperNotFound).toBe("TRANSCRIPTION_WHISPER_NOT_FOUND");
      expect(TRANSCRIPTION_ERROR_CODE.TranscriptionFailed).toBe("TRANSCRIPTION_FAILED");
      expect(TRANSCRIPTION_ERROR_CODE.InvalidAudio).toBe("TRANSCRIPTION_INVALID_AUDIO");
      expect(TRANSCRIPTION_ERROR_CODE.ParseFailed).toBe("TRANSCRIPTION_PARSE_FAILED");
    });

    it("has all LLM error codes", () => {
      expect(LLM_ERROR_CODE.ProviderNotFound).toBe("LLM_PROVIDER_NOT_FOUND");
      expect(LLM_ERROR_CODE.CompletionFailed).toBe("LLM_COMPLETION_FAILED");
      expect(LLM_ERROR_CODE.EmptyResponse).toBe("LLM_EMPTY_RESPONSE");
      expect(LLM_ERROR_CODE.Timeout).toBe("LLM_TIMEOUT");
    });

    it("has all pipeline error codes", () => {
      expect(PIPELINE_ERROR_CODE.StageFailed).toBe("PIPELINE_STAGE_FAILED");
      expect(PIPELINE_ERROR_CODE.Aborted).toBe("PIPELINE_ABORTED");
    });
  });
});
