/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhisperTranscriber } from "./whisper.transcriber.js";
import { WhisperOutputParser } from "./whisper-output.parser.js";
import { HallucinationFilter } from "./hallucination.filter.js";
import type { ProcessRunner, ProcessOutput } from "../../infrastructure/process.runner.js";
import type { ProcessError } from "../../infrastructure/process.runner.js";
import type { FilesystemManager, FilesystemError } from "../../infrastructure/filesystem.manager.js";
import { ok, err, type Result } from "../../shared/result.js";

function createMockProcessRunner(): ProcessRunner {
  return {
    run: vi.fn(),
    runWithProgress: vi.fn(),
  } as unknown as ProcessRunner;
}

function createMockFilesystemManager(): FilesystemManager {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    ensureDir: vi.fn(),
    fileSize: vi.fn(),
    resolvePath: vi.fn(),
  } as unknown as FilesystemManager;
}

const WHISPER_JSON = JSON.stringify({
  transcription: [
    {
      timestamps: { from: "00:00:00,000", to: "00:00:05,000" },
      offsets: { from: 0, to: 5000 },
      text: " Normal speech here.",
      tokens: [
        { text: " Normal", p: 0.9 },
        { text: " speech", p: 0.85 },
        { text: " here", p: 0.88 },
        { text: ".", p: 0.92 },
      ],
    },
    {
      timestamps: { from: "00:00:05,000", to: "00:00:10,000" },
      offsets: { from: 5000, to: 10000 },
      text: " More content.",
      tokens: [
        { text: " More", p: 0.87 },
        { text: " content", p: 0.91 },
        { text: ".", p: 0.89 },
      ],
    },
  ],
  result: { language: "en" },
});

describe("WhisperTranscriber", () => {
  let processRunner: ProcessRunner;
  let filesystemManager: FilesystemManager;
  let transcriber: WhisperTranscriber;

  beforeEach(() => {
    processRunner = createMockProcessRunner();
    filesystemManager = createMockFilesystemManager();
    transcriber = new WhisperTranscriber(
      processRunner,
      filesystemManager,
      new WhisperOutputParser(),
      new HallucinationFilter(),
    );
  });

  it("transcribes audio file successfully", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(WHISPER_JSON) as Result<string, FilesystemError>,
    );

    const result = await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.segments).toHaveLength(2);
      expect(result.value.language).toBe("en");
      expect(result.value.fullText).toContain("Normal speech here.");
    }
  });

  it("filters hallucination segments", async () => {
    const jsonWithHallucination = JSON.stringify({
      transcription: [
        {
          timestamps: { from: "00:00:00,000", to: "00:00:05,000" },
          offsets: { from: 0, to: 5000 },
          text: " Normal text.",
          tokens: [{ text: " Normal", p: 0.9 }, { text: " text", p: 0.88 }, { text: ".", p: 0.9 }],
        },
        {
          timestamps: { from: "00:00:05,000", to: "00:00:10,000" },
          offsets: { from: 5000, to: 10000 },
          text: " Спасибо за просмотр!",
          tokens: [{ text: " Спасибо", p: 0.7 }, { text: " за", p: 0.8 }, { text: " просмотр", p: 0.75 }],
        },
      ],
      result: { language: "ru" },
    });

    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(jsonWithHallucination) as Result<string, FilesystemError>,
    );

    const result = await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.segments).toHaveLength(1);
      expect(result.value.fullText).toBe("Normal text.");
    }
  });

  it("returns error when whisper process fails", async () => {
    const processError = {
      command: "whisper-cli",
      exitCode: 1,
      stderr: "model not found",
      message: "model not found",
      name: "ProcessError",
    };
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      err(processError) as Result<ProcessOutput, ProcessError>,
    );

    const result = await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRANSCRIPTION_FAILED");
    }
  });

  it("returns error when output file not found", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(false);

    const result = await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRANSCRIPTION_PARSE_FAILED");
    }
  });

  it("passes correct arguments to whisper-cli", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(WHISPER_JSON) as Result<string, FilesystemError>,
    );

    await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "/models/large-v3-turbo.bin", language: "ru", outputDir: "/tmp" },
      vi.fn(),
    );

    const call = vi.mocked(processRunner.runWithProgress).mock.calls[0];
    expect(call?.[0]).toBe("whisper-cli");
    const args = call?.[1] as string[];
    expect(args).toContain("-f");
    expect(args).toContain("/tmp/audio.wav");
    expect(args).toContain("--output-json-full");
    expect(args).toContain("-m");
    expect(args).toContain("/models/large-v3-turbo.bin");
    expect(args).toContain("-l");
    expect(args).toContain("ru");
  });

  it("omits -l flag when language is auto", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(WHISPER_JSON) as Result<string, FilesystemError>,
    );

    await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    const call = vi.mocked(processRunner.runWithProgress).mock.calls[0];
    const args = call?.[1] as string[];
    expect(args).not.toContain("-l");
  });

  it("resolves model name to ggml path using modelDir", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(WHISPER_JSON) as Result<string, FilesystemError>,
    );

    await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "large-v3-turbo", language: "auto", outputDir: "/tmp", modelDir: "/home/user/models" },
      vi.fn(),
    );

    const call = vi.mocked(processRunner.runWithProgress).mock.calls[0];
    const args = call?.[1] as string[];
    expect(args).toContain("-m");
    const mIndex = args.indexOf("-m");
    expect(args[mIndex + 1]).toBe("/home/user/models/ggml-large-v3-turbo.bin");
  });

  it("uses absolute model path as-is", async () => {
    vi.mocked(processRunner.runWithProgress).mockResolvedValue(
      ok({ stdout: "", stderr: "", exitCode: 0 }),
    );
    vi.mocked(filesystemManager.exists).mockResolvedValue(true);
    vi.mocked(filesystemManager.readFile).mockResolvedValue(
      ok(WHISPER_JSON) as Result<string, FilesystemError>,
    );

    await transcriber.transcribe(
      "/tmp/audio.wav",
      { model: "/custom/path/ggml-large-v3-turbo.bin", language: "auto", outputDir: "/tmp" },
      vi.fn(),
    );

    const call = vi.mocked(processRunner.runWithProgress).mock.calls[0];
    const args = call?.[1] as string[];
    const mIndex = args.indexOf("-m");
    expect(args[mIndex + 1]).toBe("/custom/path/ggml-large-v3-turbo.bin");
  });
});
