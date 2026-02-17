import { TranscriptionSegment } from "./transcription-segment.js";

export class TranscriptionResult {
  readonly segments: readonly TranscriptionSegment[];
  readonly fullText: string;
  readonly language: string;
  readonly averageConfidence: number;
  readonly durationMs: number;

  constructor(params: {
    segments: readonly TranscriptionSegment[];
    language: string;
  }) {
    this.segments = params.segments;
    this.language = params.language;
    this.fullText = params.segments.map((s) => s.text).join(" ").trim();
    this.averageConfidence = this.calculateAverageConfidence(params.segments);
    this.durationMs =
      params.segments.length > 0
        ? (params.segments[params.segments.length - 1]?.endMs ?? 0)
        : 0;
  }

  private calculateAverageConfidence(segments: readonly TranscriptionSegment[]): number {
    if (segments.length === 0) {
      return 0;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const segment of segments) {
      const weight = segment.durationMs;
      weightedSum += segment.confidence * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return weightedSum / totalWeight;
  }
}
