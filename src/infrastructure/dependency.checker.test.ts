/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DependencyChecker } from "./dependency.checker.js";
import { ok, err } from "../shared/result.js";
import { ProcessError, type ProcessRunner } from "./process.runner.js";

describe("DependencyChecker", () => {
  let mockRunner: ProcessRunner;
  let checker: DependencyChecker;

  beforeEach(() => {
    mockRunner = {
      run: vi.fn().mockResolvedValue(
        ok({ stdout: "1.0.0\n", stderr: "", exitCode: 0 }),
      ),
      runWithProgress: vi.fn(),
    } as unknown as ProcessRunner;

    checker = new DependencyChecker(mockRunner);
  });

  it("checks single dependency successfully", async () => {
    const status = await checker.check("yt-dlp", "yt-dlp", ["--version"]);
    expect(status.name).toBe("yt-dlp");
    expect(status.available).toBe(true);
    expect(status.version).toBe("1.0.0");
  });

  it("reports missing dependency", async () => {
    vi.mocked(mockRunner.run).mockResolvedValue(
      err(new ProcessError("yt-dlp", 1, "not found")),
    );

    const status = await checker.check("yt-dlp", "yt-dlp", ["--version"]);
    expect(status.name).toBe("yt-dlp");
    expect(status.available).toBe(false);
    expect(status.version).toBeUndefined();
  });

  it("checks all required dependencies", async () => {
    const statuses = await checker.checkAll();
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.name)).toEqual(["yt-dlp", "ffmpeg", "whisper-cli"]);
  });

  it("ensureRequired passes when all available", async () => {
    const statuses = await checker.ensureRequired();
    expect(statuses).toHaveLength(3);
    expect(statuses.every((s) => s.available)).toBe(true);
  });

  it("ensureRequired throws when dependency missing", async () => {
    vi.mocked(mockRunner.run).mockImplementation((command: string) => {
      if (command === "ffmpeg") {
        return Promise.resolve(err(new ProcessError("ffmpeg", 1, "not found")));
      }
      return Promise.resolve(ok({ stdout: "1.0.0\n", stderr: "", exitCode: 0 }));
    });

    await expect(checker.ensureRequired()).rejects.toThrow("ffmpeg");
  });

  it("ensureRequired lists all missing dependencies", async () => {
    vi.mocked(mockRunner.run).mockResolvedValue(
      err(new ProcessError("cmd", 1, "not found")),
    );

    await expect(checker.ensureRequired()).rejects.toThrow("yt-dlp, ffmpeg, whisper-cli");
  });
});
