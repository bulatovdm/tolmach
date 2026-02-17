import type { Result } from "../../shared/result.js";
import type { VideoError } from "../../shared/errors.js";
import type { ProgressCallback } from "../../shared/types.js";
import type { DownloadedVideo } from "./downloaded-video.js";
import type { VideoMetadata } from "./video-metadata.js";

export interface VideoProvider {
  readonly name: string;
  canHandle(url: string): boolean;
  download(
    url: string,
    outputDir: string,
    onProgress: ProgressCallback,
  ): Promise<Result<DownloadedVideo, VideoError>>;
  extractMetadata(url: string): Promise<Result<VideoMetadata, VideoError>>;
}
