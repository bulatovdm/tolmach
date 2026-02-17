/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "./config.manager.js";
import { ok } from "../shared/result.js";
import type { FilesystemManager } from "./filesystem.manager.js";

describe("ConfigManager", () => {
  let mockFs: FilesystemManager;
  let configManager: ConfigManager;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean env
    delete process.env["LLM_PROVIDER"];
    delete process.env["LLM_MODEL"];
    delete process.env["WHISPER_MODEL"];
    delete process.env["WHISPER_LANGUAGE"];
    delete process.env["WHISPER_BINARY"];
    delete process.env["TOLMACH_OUTPUT_DIR"];
    delete process.env["TOLMACH_CACHE_DIR"];
    delete process.env["TOLMACH_CACHE_ENABLED"];

    mockFs = {
      exists: vi.fn().mockResolvedValue(false),
      readFile: vi.fn().mockResolvedValue(ok("{}")),
      writeFile: vi.fn().mockResolvedValue(ok(undefined)),
      ensureDir: vi.fn().mockResolvedValue(undefined),
    } as unknown as FilesystemManager;

    configManager = new ConfigManager(mockFs);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads default config when no file or env", async () => {
    const config = await configManager.load();
    expect(config.llm.provider).toBe("claude-agent");
    expect(config.whisper.model).toBe("large-v3-turbo");
    expect(config.whisper.language).toBe("auto");
    expect(config.cache.enabled).toBe(true);
  });

  it("loads config from JSON file", async () => {
    vi.mocked(mockFs.exists).mockResolvedValue(true);
    vi.mocked(mockFs.readFile).mockResolvedValue(
      ok(JSON.stringify({ llm: { provider: "mock" } })),
    );

    const config = await configManager.load();
    expect(config.llm.provider).toBe("mock");
  });

  it("env vars override file config", async () => {
    vi.mocked(mockFs.exists).mockResolvedValue(true);
    vi.mocked(mockFs.readFile).mockResolvedValue(
      ok(JSON.stringify({ whisper: { model: "tiny" } })),
    );
    process.env["WHISPER_MODEL"] = "large-v3-turbo";

    const config = await configManager.load();
    expect(config.whisper.model).toBe("large-v3-turbo");
  });

  it("CLI overrides take highest priority", async () => {
    process.env["LLM_PROVIDER"] = "mock";

    const config = await configManager.load({
      llmProvider: "claude-agent",
    });

    expect(config.llm.provider).toBe("claude-agent");
  });

  it("throws when accessing current before load", () => {
    expect(() => configManager.current).toThrow("Config not loaded");
  });

  it("returns current config after load", async () => {
    await configManager.load();
    const config = configManager.current;
    expect(config.llm.provider).toBe("claude-agent");
  });

  it("saves config to file", async () => {
    await configManager.save({ llm: { provider: "mock", maxTokens: 4096, temperature: 0 } });

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("config.json"),
      expect.stringContaining("mock"),
    );
  });

  it("returns config path", () => {
    expect(configManager.configPath).toContain("config.json");
    expect(configManager.configPath).toContain(".tolmach");
  });

  it("handles env vars for cache settings", async () => {
    process.env["TOLMACH_CACHE_ENABLED"] = "false";
    process.env["TOLMACH_CACHE_DIR"] = "/custom/cache";

    const config = await configManager.load();
    expect(config.cache.enabled).toBe(false);
    expect(config.cache.dir).toBe("/custom/cache");
  });

  it("CLI whisper model overrides env", async () => {
    process.env["WHISPER_MODEL"] = "tiny";

    const config = await configManager.load({ whisperModel: "medium" });
    expect(config.whisper.model).toBe("medium");
  });

  it("CLI language override works", async () => {
    const config = await configManager.load({ language: "ru" });
    expect(config.whisper.language).toBe("ru");
  });

  it("CLI output dir override works", async () => {
    const config = await configManager.load({ outputDir: "/custom/reports" });
    expect(config.output.dir).toBe("/custom/reports");
  });
});
