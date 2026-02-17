import { z } from "zod";
import { type Result, ok, err } from "../../shared/result.js";
import { TranscriptionError, TRANSCRIPTION_ERROR_CODE } from "../../shared/errors.js";
import { TranscriptionSegment } from "./transcription-segment.js";

const WhisperTokenSchema = z.object({
  text: z.string(),
  timestamps: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
  offsets: z
    .object({
      from: z.number(),
      to: z.number(),
    })
    .optional(),
  p: z.number(),
});

const WhisperSegmentSchema = z.object({
  timestamps: z.object({
    from: z.string(),
    to: z.string(),
  }),
  offsets: z.object({
    from: z.number(),
    to: z.number(),
  }),
  text: z.string(),
  tokens: z.array(WhisperTokenSchema).optional(),
});

const WhisperOutputSchema = z.object({
  transcription: z.array(WhisperSegmentSchema),
  result: z
    .object({
      language: z.string(),
    })
    .optional(),
});

export interface ParsedWhisperOutput {
  readonly segments: readonly TranscriptionSegment[];
  readonly language: string;
}

export class WhisperOutputParser {
  parse(jsonContent: string): Result<ParsedWhisperOutput, TranscriptionError> {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonContent);
    } catch (error) {
      return err(
        new TranscriptionError(
          TRANSCRIPTION_ERROR_CODE.ParseFailed,
          "Invalid JSON in whisper output",
          error instanceof Error ? error : undefined,
        ),
      );
    }

    const parsed = WhisperOutputSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new TranscriptionError(
          TRANSCRIPTION_ERROR_CODE.ParseFailed,
          `Invalid whisper output structure: ${parsed.error.message}`,
        ),
      );
    }

    const segments = parsed.data.transcription.map((segment) => {
      const confidence = this.calculateSegmentConfidence(segment.tokens ?? []);
      return new TranscriptionSegment({
        text: segment.text.trim(),
        startMs: segment.offsets.from,
        endMs: segment.offsets.to,
        confidence,
      });
    });

    const language = parsed.data.result?.language ?? "unknown";

    return ok({ segments, language });
  }

  private calculateSegmentConfidence(tokens: readonly { p: number }[]): number {
    if (tokens.length === 0) {
      return 0;
    }
    const sum = tokens.reduce((acc, t) => acc + t.p, 0);
    return sum / tokens.length;
  }
}
