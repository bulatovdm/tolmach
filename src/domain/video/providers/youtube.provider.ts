import { join } from "node:path";
import { type Result, ok, err } from "../../../shared/result.js";
import { VideoError, VIDEO_ERROR_CODE } from "../../../shared/errors.js";
import type { ProgressCallback } from "../../../shared/types.js";
import type { ProcessRunner } from "../../../infrastructure/process.runner.js";
import type { FilesystemManager } from "../../../infrastructure/filesystem.manager.js";
import type { VideoProvider } from "../video-provider.interface.js";
import { VideoMetadata } from "../video-metadata.js";
import { DownloadedVideo } from "../downloaded-video.js";

const YOUTUBE_URL_PATTERN =
  /(?:youtube\.com\/(?:watch|shorts|live|embed)|youtu\.be\/)/;

const DOWNLOAD_PROGRESS_PATTERN = /\[download\]\s+(\d+(?:\.\d+)?)%/;

interface YtDlpMetadata {
  readonly title: string;
  readonly uploader: string;
  readonly duration: number;
  readonly description: string;
  readonly webpage_url: string;
}

export class YouTubeProvider implements VideoProvider {
  readonly name = "youtube";

  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly filesystemManager: FilesystemManager,
  ) {}

  canHandle(url: string): boolean {
    return YOUTUBE_URL_PATTERN.test(url);
  }

  async extractMetadata(url: string): Promise<Result<VideoMetadata, VideoError>> {
    const result = await this.processRunner.run("yt-dlp", [
      "--dump-json",
      "--no-download",
      url,
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
      const raw = JSON.parse(result.value.stdout) as YtDlpMetadata;
      return ok(
        new VideoMetadata({
          title: raw.title,
          author: raw.uploader,
          durationSeconds: raw.duration,
          description: raw.description,
          url: raw.webpage_url,
          provider: this.name,
        }),
      );
    } catch (error) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.MetadataFailed,
          "Failed to parse yt-dlp metadata JSON",
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
    const metadataResult = await this.extractMetadata(url);
    if (!metadataResult.ok) {
      return err(metadataResult.error);
    }

    const metadata = metadataResult.value;
    const outputTemplate = join(outputDir, "%(title)s.%(ext)s");

    const downloadResult = await this.processRunner.runWithProgress(
      "yt-dlp",
      [
        "-x",
        "--audio-format",
        "wav",
        "--audio-quality",
        "5",
        "-f",
        "worstaudio",
        "--newline",
        "-o",
        outputTemplate,
        url,
      ],
      (line) => {
        const match = DOWNLOAD_PROGRESS_PATTERN.exec(line);
        return match?.[1] !== undefined ? parseFloat(match[1]) : undefined;
      },
      onProgress,
      { cwd: outputDir },
    );

    if (!downloadResult.ok) {
      return err(
        new VideoError(
          VIDEO_ERROR_CODE.DownloadFailed,
          `Failed to download: ${downloadResult.error.message}`,
          downloadResult.error,
        ),
      );
    }

    const audioPath = join(outputDir, `${metadata.title}.wav`);
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
}
