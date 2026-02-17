/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CacheManager } from "./cache.manager.js";
import { TranscriptionResult } from "../domain/transcription/transcription-result.js";
import { TranscriptionSegment } from "../domain/transcription/transcription-segment.js";
import { ok } from "../shared/result.js";
import type { FilesystemManager } from "./filesystem.manager.js";

describe("CacheManager", () => {
  let mockFs: FilesystemManager;
  let cacheManager: CacheManager;
  const storedFiles: Map<string, string> = new Map();

  beforeEach(() => {
    storedFiles.clear();

    mockFs = {
      exists: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(storedFiles.has(path)),
      ),
      readFile: vi.fn().mockImplementation((path: string) => {
        const content = storedFiles.get(path);
        if (content !== undefined) {
          return Promise.resolve(ok(content));
        }
        return Promise.resolve(ok(""));
      }),
      writeFile: vi.fn().mockImplementation((path: string, content: string) => {
        storedFiles.set(path, content);
        return Promise.resolve(ok(undefined));
      }),
      ensureDir: vi.fn().mockResolvedValue(undefined),
    } as unknown as FilesystemManager;

    cacheManager = new CacheManager(mockFs, "/tmp/cache");
  });

  function createTranscription(): TranscriptionResult {
    return new TranscriptionResult({
      segments: [
        new TranscriptionSegment({ text: "Hello", startMs: 0, endMs: 1000, confidence: 0.95 }),
        new TranscriptionSegment({ text: "World", startMs: 1000, endMs: 2000, confidence: 0.9 }),
      ],
      language: "en",
    });
  }

  it("returns undefined for cache miss", async () => {
    const result = await cacheManager.get("/path/audio.wav", "large-v3-turbo");
    expect(result).toBeUndefined();
  });

  it("stores and retrieves transcription", async () => {
    const transcription = createTranscription();

    await cacheManager.set("/path/audio.wav", "large-v3-turbo", transcription);
    const cached = await cacheManager.get("/path/audio.wav", "large-v3-turbo");

    expect(cached).toBeDefined();
    expect(cached?.fullText).toBe("Hello World");
    expect(cached?.language).toBe("en");
    expect(cached?.segments).toHaveLength(2);
  });

  it("returns different results for different models", async () => {
    const transcription = createTranscription();

    await cacheManager.set("/path/audio.wav", "large-v3-turbo", transcription);
    const cached = await cacheManager.get("/path/audio.wav", "tiny");

    expect(cached).toBeUndefined();
  });

  it("returns undefined for corrupted cache", async () => {
    storedFiles.set("/tmp/cache/somefile.json", "not valid json {{{");

    vi.mocked(mockFs.exists).mockResolvedValue(true);
    vi.mocked(mockFs.readFile).mockResolvedValue(ok("not valid json {{{"));

    const cached = await cacheManager.get("/path/audio.wav", "model");
    expect(cached).toBeUndefined();
  });

  it("preserves segment data through cache roundtrip", async () => {
    const transcription = createTranscription();

    await cacheManager.set("/audio.wav", "model", transcription);
    const cached = await cacheManager.get("/audio.wav", "model");

    expect(cached).toBeDefined();
    const seg = cached?.segments[0];
    expect(seg?.text).toBe("Hello");
    expect(seg?.startMs).toBe(0);
    expect(seg?.endMs).toBe(1000);
    expect(seg?.confidence).toBe(0.95);
  });
});
