import { join, basename, extname } from "node:path";
import { type Result, ok, err } from "../../../shared/result.js";
import { VideoError, VIDEO_ERROR_CODE } from "../../../shared/errors.js";
import type { ProgressCallback } from "../../../shared/types.js";
import type { ProcessRunner } from "../../../infrastructure/process.runner.js";
import type { FilesystemManager } from "../../../infrastructure/filesystem.manager.js";
import type { VideoProvider } from "../video-provider.interface.js";
import { VideoMetadata } from "../video-metadata.js";
import { DownloadedVideo } from "../downloaded-video.js";

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".webm",
  ".flv",
  ".wmv",
  ".m4v",
  ".ts",
  ".mts",
  ".m2ts",
]);

const FFMPEG_TIME_PATTERN = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/;

interface FfprobeFormat {
  readonly duration: string;
  readonly filename: string;
  readonly format_name: string;
}

export class LocalVideoProvider implements VideoProvider {
  readonly name = "local";

  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly filesystemManager: FilesystemManager,
  ) {}

  canHandle(url: string): boolean {
    const filePath = this.resolveFilePath(url);
    const ext = extname(filePath).toLowerCase();
    return filePath.startsWith("/") && VIDEO_EXTENSIONS.has(ext);
  }

  async extractMetadata(url: string): Promise<Result<VideoMetadata, VideoError>> {
    const filePath = this.resolveFilePath(url);

    const exists = await this.filesystemManager.exists(filePath);
    if (!exists) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.MetadataFailed,
          `File not found: ${filePath}`,
        ),
      );
    }

    const result = await this.processRunner.run("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);

    if (!result.ok) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.MetadataFailed,
          `Failed to extract metadata: ${result.error.message}`,
          result.error,
        ),
      );
    }

    try {
      const raw = JSON.parse(result.value.stdout) as { format: FfprobeFormat };
      const duration = parseFloat(raw.format.duration);
      const title = basename(filePath, extname(filePath));

      return ok(
        new VideoMetadata({
          title,
          author: "",
          durationSeconds: isNaN(duration) ? 0 : duration,
          description: "",
          url: filePath,
          provider: this.name,
        }),
      );
    } catch (error) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.MetadataFailed,
          "Failed to parse ffprobe metadata JSON",
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async download(
    url: string,
    outputDir: string,
    onProgress: ProgressCallback,
  ): Promise<Result<DownloadedVideo, VideoError>> {
    const filePath = this.resolveFilePath(url);

    const metadataResult = await this.extractMetadata(filePath);
    if (!metadataResult.ok) {
      return err(metadataResult.error);
    }

    const metadata = metadataResult.value;
    const outputFilename = basename(filePath, extname(filePath)) + ".wav";
    const audioPath = join(outputDir, outputFilename);
    const totalSeconds = metadata.durationSeconds;

    const convertResult = await this.processRunner.runWithProgress(
      "ffmpeg",
      [
        "-i",
        filePath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-y",
        audioPath,
      ],
      (line) => {
        if (totalSeconds <= 0) return undefined;
        const match = FFMPEG_TIME_PATTERN.exec(line);
        if (!match) return undefined;
        const hours = parseInt(match[1]!, 10);
        const minutes = parseInt(match[2]!, 10);
        const seconds = parseInt(match[3]!, 10);
        const centiseconds = parseInt(match[4]!, 10);
        const currentSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
        return Math.min((currentSeconds / totalSeconds) * 100, 100);
      },
      onProgress,
    );

    if (!convertResult.ok) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.DownloadFailed,
          `Failed to convert audio: ${convertResult.error.message}`,
          convertResult.error,
        ),
      );
    }

    const sizeResult = await this.filesystemManager.fileSize(audioPath);
    const fileSizeBytes = sizeResult.ok ? sizeResult.value : 0;

    return ok(
      new DownloadedVideo({
        audioPath,
        metadata,
        fileSizeBytes,
      }),
    );
  }

  private resolveFilePath(url: string): string {
    if (url.startsWith("file://")) {
      return decodeURIComponent(url.slice(7));
    }
    return url;
  }
}
