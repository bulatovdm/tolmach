export class TranscriptionSegment {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly confidence: number;

  constructor(params: {
    text: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }) {
    if (params.startMs < 0) {
      throw new Error("Start time must be non-negative");
    }
    if (params.endMs < params.startMs) {
      throw new Error("End time must be >= start time");
    }
    if (params.confidence < 0 || params.confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }

    this.text = params.text;
    this.startMs = params.startMs;
    this.endMs = params.endMs;
    this.confidence = params.confidence;
  }

  get durationMs(): number {
    return this.endMs - this.startMs;
  }
}
