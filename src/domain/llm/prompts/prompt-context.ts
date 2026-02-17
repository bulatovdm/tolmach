import type { VideoMetadata } from "../../video/video-metadata.js";
import type { TranscriptionResult } from "../../transcription/transcription-result.js";

export class PromptContext {
  readonly metadata: VideoMetadata;
  readonly transcription: TranscriptionResult;

  constructor(params: {
    metadata: VideoMetadata;
    transcription: TranscriptionResult;
  }) {
    this.metadata = params.metadata;
    this.transcription = params.transcription;
  }
}
