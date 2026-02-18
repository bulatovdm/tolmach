/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VimeoProvider } from "./vimeo.provider.js";
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
  title: "Test Vimeo Video",
  uploader: "Test Author",
  duration: 300,
  description: "A test Vimeo video",
  webpage_url: "https://vimeo.com/123456789",
});

describe("VimeoProvider", () => {
  let processRunner: ProcessRunner;
  let filesystemManager: FilesystemManager;
  let provider: VimeoProvider;

  beforeEach(() => {
    processRunner = createMockProcessRunner();
    filesystemManager = createMockFilesystemManager();
    provider = new VimeoProvider(processRunner, filesystemManager);
  });

  describe("canHandle", () => {
    it("handles standard vimeo.com URLs", () => {
      expect(provider.canHandle("https://vimeo.com/123456789")).toBe(true);
    });

    it("handles vimeo.com URLs with hash (private links)", () => {
      expect(provider.canHandle("https://vimeo.com/1165505337/9016b5c3fb")).toBe(true);
    });

    it("handles vimeo.com URLs with query params", () => {
      expect(provider.canHandle("https://vimeo.com/1165505337/9016b5c3fb?fl=pl&fe=cm")).toBe(true);
    });

    it("rejects non-Vimeo URLs", () => {
      expect(provider.canHandle("https://youtube.com/watch?v=abc")).toBe(false);
      expect(provider.canHandle("https://example.com/video")).toBe(false);
    });
  });

  describe("extractMetadata", () => {
    it("extracts metadata from yt-dlp output", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("https://vimeo.com/123456789");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("Test Vimeo Video");
        expect(result.value.author).toBe("Test Author");
        expect(result.value.durationSeconds).toBe(300);
        expect(result.value.provider).toBe("vimeo");
      }
    });

    it("calls yt-dlp with correct arguments", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_YT_DLP_JSON, stderr: "", exitCode: 0 }),
      );

      await provider.extractMetadata("https://vimeo.com/123456789");

      expect(processRunner.run).toHaveBeenCalledWith("yt-dlp", [
        "--dump-json",
        "--no-download",
        "https://vimeo.com/123456789",
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

      const result = await provider.extractMetadata("https://vimeo.com/123456789");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });

    it("returns error when JSON parsing fails", async () => {
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: "not json", stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("https://vimeo.com/123456789");
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
        ok(512000) as Result<number, FilesystemError>,
      );

      const result = await provider.download("https://vimeo.com/123456789", "/tmp", vi.fn());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.title).toBe("Test Vimeo Video");
        expect(result.value.fileSizeBytes).toBe(512000);
        expect(result.value.audioPath).toContain("Test Vimeo Video.wav");
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

      const result = await provider.download("https://vimeo.com/123456789", "/tmp", vi.fn());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_DOWNLOAD_FAILED");
      }
    });
  });
});
