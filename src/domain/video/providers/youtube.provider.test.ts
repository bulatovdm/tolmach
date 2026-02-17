/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { YouTubeProvider } from "./youtube.provider.js";
import type { ProcessRunner, ProcessOutput } from "../../../infrastructure/process.runner.js";
import type { ProcessError } from "../../../infrastructure/process.runner.js";
import type { FilesystemManager, FilesystemError } from "../../../infrastructure/filesystem.manager.js";
import { ok, err, type Result } from "../../../shared/result.js";

function createMockProcessRunner(): ProcessRunner {
  return {
    run: vi.fn(),
    runWithProgress: vi.fn(),
  } as unknown as ProcessRunner;
}

function createMockFilesystemManager(): FilesystemManager {
  return {
    fileSize: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    ensureDir: vi.fn(),
    resolvePath: vi.fn(),
  } as unknown as FilesystemManager;
}

const SAMPLE_YT_DLP_JSON = JSON.stringify({
  title: "Test Video Title",
  uploader: "Test Channel",
  duration: 754,
  description: "Test description",
  webpage_url: "https://www.youtube.com/watch?v=abc123",
});

describe("YouTubeProvider", () => {
  let processRunner: ProcessRunner;
  let filesystemManager: FilesystemManager;
  let provider: YouTubeProvider;

  beforeEach(() => {
    processRunner = createMockProcessRunner();
    filesystemManager = createMockFilesystemManager();
    provider = new YouTubeProvider(processRunner, filesystemManager);
  });

  describe("canHandle", () => {
    it("handles youtube.com/watch URLs", () => {
      expect(provider.canHandle("https://www.youtube.com/watch?v=abc123")).toBe(true);
    });

    it("handles youtu.be short URLs", () => {
      expect(provider.canHandle("https://youtu.be/abc123")).toBe(true);
    });

    it("handles youtube.com/shorts URLs", () => {
      expect(provider.canHandle("https://www.youtube.com/shorts/abc123")).toBe(true);
    });

    it("handles youtube.com/live URLs", () => {
      expect(provider.canHandle("https://www.youtube.com/live/abc123")).toBe(true);
    });

    it("handles youtube.com/embed URLs", () => {
      expect(provider.canHandle("https://www.youtube.com/embed/abc123")).toBe(true);
    });

    it("rejects non-YouTube URLs", () => {
      expect(provider.canHandle("https://vimeo.com/123")).toBe(false);
      expect(provider.canHandle("https://example.com/video")).toBe(false);
    });
  });

  describe("extractMetadata", () => {
    it("extracts metadata from yt-dlp output", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("https://youtube.com/watch?v=abc123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("Test Video Title");
        expect(result.value.author).toBe("Test Channel");
        expect(result.value.durationSeconds).toBe(754);
        expect(result.value.provider).toBe("youtube");
      }
    });

    it("calls yt-dlp with correct arguments", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );

      await provider.extractMetadata("https://youtube.com/watch?v=abc123");

      expect(processRunner.run).toHaveBeenCalledWith("yt-dlp", [
        "--dump-json",
        "--no-download",
        "https://youtube.com/watch?v=abc123",
      ]);
    });

    it("returns error when yt-dlp fails", async () => {
      const processError = {
        command: "yt-dlp",
        exitCode: 1,
        stderr: "network error",
        message: "network error",
        name: "ProcessError",
      };
      vi.mocked(processRunner.run).mockResolvedValue(
        err(processError) as Result<ProcessOutput, ProcessError>,
      );

      const result = await provider.extractMetadata("https://youtube.com/watch?v=abc123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });

    it("returns error when JSON parsing fails", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: "not json", stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("https://youtube.com/watch?v=abc123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });
  });

  describe("download", () => {
    it("downloads and returns DownloadedVideo", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        ok({ stdout: "", stderr: "", exitCode: 0 }),
      );
      vi.mocked(filesystemManager.fileSize).mockResolvedValue(
        ok(1024000) as Result<number, FilesystemError>,
      );

      const result = await provider.download("https://youtube.com/watch?v=abc123", "/tmp", vi.fn());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.title).toBe("Test Video Title");
        expect(result.value.fileSizeBytes).toBe(1024000);
        expect(result.value.audioPath).toContain("Test Video Title.wav");
      }
    });

    it("returns error when download fails", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );
      const processError = {
        command: "yt-dlp",
        exitCode: 1,
        stderr: "download failed",
        message: "download failed",
        name: "ProcessError",
      };
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        err(processError) as Result<ProcessOutput, ProcessError>,
      );

      const result = await provider.download("https://youtube.com/watch?v=abc123", "/tmp", vi.fn());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_DOWNLOAD_FAILED");
      }
    });
  });
});
