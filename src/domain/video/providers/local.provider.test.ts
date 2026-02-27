/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalVideoProvider } from "./local.provider.js";
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
    removeDir: vi.fn(),
  } as unknown as FilesystemManager;
}

const SAMPLE_FFPROBE_JSON = JSON.stringify({
  format: {
    duration: "125.340000",
    filename: "/tmp/test-video.mp4",
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
  },
});

describe("LocalVideoProvider", () => {
  let processRunner: ProcessRunner;
  let filesystemManager: FilesystemManager;
  let provider: LocalVideoProvider;

  beforeEach(() => {
    processRunner = createMockProcessRunner();
    filesystemManager = createMockFilesystemManager();
    provider = new LocalVideoProvider(processRunner, filesystemManager);
  });

  describe("canHandle", () => {
    it("handles absolute paths to .mp4 files", () => {
      expect(provider.canHandle("/Users/user/video.mp4")).toBe(true);
    });

    it("handles absolute paths to .mkv files", () => {
      expect(provider.canHandle("/tmp/recording.mkv")).toBe(true);
    });

    it("handles absolute paths to .avi files", () => {
      expect(provider.canHandle("/home/user/clip.avi")).toBe(true);
    });

    it("handles absolute paths to .mov files", () => {
      expect(provider.canHandle("/data/video.mov")).toBe(true);
    });

    it("handles absolute paths to .webm files", () => {
      expect(provider.canHandle("/tmp/screen.webm")).toBe(true);
    });

    it("handles file:// URIs", () => {
      expect(provider.canHandle("file:///Users/user/video.mp4")).toBe(true);
    });

    it("handles file:// URIs with encoded spaces", () => {
      expect(provider.canHandle("file:///Users/user/my%20video.mp4")).toBe(true);
    });

    it("handles paths with spaces", () => {
      expect(provider.canHandle("/Users/user/my video folder/clip.mp4")).toBe(true);
    });

    it("rejects http URLs", () => {
      expect(provider.canHandle("https://example.com/video.mp4")).toBe(false);
    });

    it("rejects YouTube URLs", () => {
      expect(provider.canHandle("https://youtube.com/watch?v=abc123")).toBe(false);
    });

    it("rejects non-video extensions", () => {
      expect(provider.canHandle("/tmp/document.pdf")).toBe(false);
      expect(provider.canHandle("/tmp/image.png")).toBe(false);
      expect(provider.canHandle("/tmp/audio.mp3")).toBe(false);
    });

    it("rejects relative paths", () => {
      expect(provider.canHandle("video.mp4")).toBe(false);
      expect(provider.canHandle("./video.mp4")).toBe(false);
    });
  });

  describe("extractMetadata", () => {
    it("extracts metadata from ffprobe output", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("/tmp/test-video.mp4");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toBe("test-video");
        expect(result.value.durationSeconds).toBe(125.34);
        expect(result.value.provider).toBe("local");
        expect(result.value.url).toBe("/tmp/test-video.mp4");
        expect(result.value.author).toBe("");
      }
    });

    it("calls ffprobe with correct arguments", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );

      await provider.extractMetadata("/tmp/test-video.mp4");

      expect(processRunner.run).toHaveBeenCalledWith("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "/tmp/test-video.mp4",
      ]);
    });

    it("returns error when file does not exist", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(false);

      const result = await provider.extractMetadata("/tmp/nonexistent.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
        expect(result.error.message).toContain("File not found");
      }
    });

    it("returns error when ffprobe fails", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      const processError = {
        command: "ffprobe",
        exitCode: 1,
        stderr: "not a valid media file",
        message: "not a valid media file",
        name: "ProcessError",
      };
      vi.mocked(processRunner.run).mockResolvedValue(
        err(processError) as Result<ProcessOutput, ProcessError>,
      );

      const result = await provider.extractMetadata("/tmp/test-video.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });

    it("returns error when JSON parsing fails", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: "not json", stderr: "", exitCode: 0 }),
      );

      const result = await provider.extractMetadata("/tmp/test-video.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });

    it("resolves file:// URIs", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );

      await provider.extractMetadata("file:///tmp/test-video.mp4");

      expect(filesystemManager.exists).toHaveBeenCalledWith("/tmp/test-video.mp4");
      expect(processRunner.run).toHaveBeenCalledWith("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "/tmp/test-video.mp4",
      ]);
    });
  });

  describe("download", () => {
    it("converts video to WAV and returns DownloadedVideo", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        ok({ stdout: "", stderr: "", exitCode: 0 }),
      );
      vi.mocked(filesystemManager.fileSize).mockResolvedValue(
        ok(2048000) as Result<number, FilesystemError>,
      );

      const result = await provider.download("/tmp/test-video.mp4", "/output", vi.fn());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.audioPath).toBe("/output/test-video.wav");
        expect(result.value.metadata.title).toBe("test-video");
        expect(result.value.fileSizeBytes).toBe(2048000);
      }
    });

    it("calls ffmpeg with correct arguments", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        ok({ stdout: "", stderr: "", exitCode: 0 }),
      );
      vi.mocked(filesystemManager.fileSize).mockResolvedValue(
        ok(1024) as Result<number, FilesystemError>,
      );

      await provider.download("/tmp/test-video.mp4", "/output", vi.fn());

      expect(processRunner.runWithProgress).toHaveBeenCalledWith(
        "ffmpeg",
        [
          "-i",
          "/tmp/test-video.mp4",
          "-vn",
          "-acodec",
          "pcm_s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
          "-y",
          "/output/test-video.wav",
        ],
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("returns error when metadata extraction fails", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(false);

      const result = await provider.download("/tmp/nonexistent.mp4", "/output", vi.fn());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_METADATA_FAILED");
      }
    });

    it("returns error when ffmpeg conversion fails", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );
      const processError = {
        command: "ffmpeg",
        exitCode: 1,
        stderr: "conversion failed",
        message: "conversion failed",
        name: "ProcessError",
      };
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        err(processError) as Result<ProcessOutput, ProcessError>,
      );

      const result = await provider.download("/tmp/test-video.mp4", "/output", vi.fn());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_DOWNLOAD_FAILED");
      }
    });

    it("parses ffmpeg progress from time output", async () => {
      vi.mocked(filesystemManager.exists).mockResolvedValue(true);
      vi.mocked(processRunner.run).mockResolvedValue(
        ok({ stdout: SAMPLE_FFPROBE_JSON, stderr: "", exitCode: 0 }),
      );
      vi.mocked(processRunner.runWithProgress).mockResolvedValue(
        ok({ stdout: "", stderr: "", exitCode: 0 }),
      );
      vi.mocked(filesystemManager.fileSize).mockResolvedValue(
        ok(1024) as Result<number, FilesystemError>,
      );

      await provider.download("/tmp/test-video.mp4", "/output", vi.fn());

      const progressParser = vi.mocked(processRunner.runWithProgress).mock.calls[0]![2] as (line: string) => number | undefined;

      expect(progressParser("size=    1024kB time=00:01:02.67 bitrate= 133.5kbits/s speed=2.5x")).toBeCloseTo(50.0, 0);
      expect(progressParser("random output")).toBeUndefined();
      expect(progressParser("size=    2048kB time=00:02:05.34 bitrate= 133.5kbits/s speed=2.5x")).toBeCloseTo(100, 0);
    });
  });
});
