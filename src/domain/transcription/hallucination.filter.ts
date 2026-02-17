import type { TranscriptionSegment } from "./transcription-segment.js";

const DEFAULT_HALLUCINATIONS = [
  "продолжение следует",
  "спасибо за просмотр",
  "подписывайтесь на канал",
  "ставьте лайки",
  "thanks for watching",
  "subscribe to the channel",
  "subtitles by",
  "thank you for watching",
];

const SOUND_DESCRIPTION_PATTERN = /^[\p{Lu}\s]+$/u;
const REPETITIVE_PATTERN = /(.{2,})\1{3,}/;
const FOREIGN_SCRIPT_PATTERN = /[\u0370-\u03FF\u4E00-\u9FFF\u0600-\u06FF\u3040-\u30FF\u3400-\u4DBF]/;

export class HallucinationFilter {
  private readonly knownHallucinations: ReadonlySet<string>;

  constructor(hallucinations?: readonly string[]) {
    this.knownHallucinations = new Set(
      (hallucinations ?? DEFAULT_HALLUCINATIONS).map((h) => h.toLowerCase()),
    );
  }

  isHallucination(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return true;
    }

    const lower = trimmed.toLowerCase();
    for (const hallucination of this.knownHallucinations) {
      if (lower.includes(hallucination)) {
        return true;
      }
    }

    if (trimmed.length > 3 && SOUND_DESCRIPTION_PATTERN.test(trimmed)) {
      return true;
    }

    if (REPETITIVE_PATTERN.test(trimmed)) {
      return true;
    }

    return FOREIGN_SCRIPT_PATTERN.test(trimmed);
  }

  filterSegments(
    segments: readonly TranscriptionSegment[],
  ): readonly TranscriptionSegment[] {
    return segments.filter((s) => !this.isHallucination(s.text));
  }
}
