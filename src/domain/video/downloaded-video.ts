import { VideoMetadata } from "./video-metadata.js";

export class DownloadedVideo {
  readonly audioPath: string;
  readonly metadata: VideoMetadata;
  readonly fileSizeBytes: number;

  constructor(params: {
    audioPath: string;
    metadata: VideoMetadata;
    fileSizeBytes: number;
  }) {
    if (!params.audioPath.trim()) {
      throw new Error("Audio path must not be empty");
    }
    if (params.fileSizeBytes < 0) {
      throw new Error("File size must be non-negative");
    }

    this.audioPath = params.audioPath;
    this.metadata = params.metadata;
    this.fileSizeBytes = params.fileSizeBytes;
  }
}
