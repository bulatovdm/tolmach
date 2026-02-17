import { createHash } from "node:crypto";
import { join } from "node:path";
import type { FilesystemManager } from "./filesystem.manager.js";
import type { TranscriptionResult } from "../domain/transcription/transcription-result.js";
import { TranscriptionResult as TranscriptionResultClass } from "../domain/transcription/transcription-result.js";
import { TranscriptionSegment } from "../domain/transcription/transcription-segment.js";

interface CachedTranscription {
  readonly segments: ReadonlyArray<{
    readonly text: string;
    readonly startMs: number;
    readonly endMs: number;
    readonly confidence: number;
  }>;
  readonly language: string;
  readonly cachedAt: string;
}

export class CacheManager {
  constructor(
    private readonly filesystemManager: FilesystemManager,
    private readonly cacheDir: string,
  ) {}

  async get(audioPath: string, model: string): Promise<TranscriptionResult | undefined> {
    const key = this.buildKey(audioPath, model);
    const cachePath = join(this.cacheDir, `${key}.json`);

    const exists = await this.filesystemManager.exists(cachePath);
    if (!exists) {
      return undefined;
    }

    const readResult = await this.filesystemManager.readFile(cachePath);
    if (!readResult.ok) {
      return undefined;
    }

    try {
      const cached = JSON.parse(readResult.value) as CachedTranscription;
      const segments = cached.segments.map(
        (s) => new TranscriptionSegment(s),
      );
      return new TranscriptionResultClass({ segments, language: cached.language });
    } catch {
      return undefined;
    }
  }

  async set(audioPath: string, model: string, result: TranscriptionResult): Promise<void> {
    const key = this.buildKey(audioPath, model);
    const cachePath = join(this.cacheDir, `${key}.json`);

    const cached: CachedTranscription = {
      segments: result.segments.map((s) => ({
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
        confidence: s.confidence,
      })),
      language: result.language,
      cachedAt: new Date().toISOString(),
    };

    await this.filesystemManager.ensureDir(this.cacheDir);
    await this.filesystemManager.writeFile(cachePath, JSON.stringify(cached, null, 2));
  }

  private buildKey(audioPath: string, model: string): string {
    const hash = createHash("sha256")
      .update(`${audioPath}:${model}`)
      .digest("hex")
      .slice(0, 16);
    return hash;
  }
}
