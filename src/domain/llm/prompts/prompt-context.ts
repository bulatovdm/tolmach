import type { VideoMetadata } from "../../video/video-metadata.js";
import type { TranscriptionResult } from "../../transcription/transcription-result.js";

export class PromptContext {
  readonly metadata: VideoMetadata;
  readonly transcription: TranscriptionResult;
  readonly reportLanguage: string;

  constructor(params: {
    metadata: VideoMetadata;
    transcription: TranscriptionResult;
    reportLanguage?: string | undefined;
  }) {
    this.metadata = params.metadata;
    this.transcription = params.transcription;
    this.reportLanguage = params.reportLanguage ?? "ru";
  }
}
