import { join } from "node:path";
import { homedir } from "node:os";
import { config as dotenvConfig } from "dotenv";
import { TolmachConfigSchema, type TolmachConfig } from "../config/default.config.js";
import type { FilesystemManager } from "./filesystem.manager.js";

export interface CliOverrides {
  readonly llmProvider?: string | undefined;
  readonly llmModel?: string | undefined;
  readonly whisperModel?: string | undefined;
  readonly language?: string | undefined;
  readonly outputDir?: string | undefined;
}

const CONFIG_PATH = join(homedir(), ".tolmach", "config.json");

export class ConfigManager {
  private config: TolmachConfig | undefined;

  constructor(
    private readonly filesystemManager: FilesystemManager,
  ) {}

  async load(cliOverrides?: CliOverrides): Promise<TolmachConfig> {
    dotenvConfig();

    const fileConfig = await this.loadFileConfig();
    const envConfig = this.loadEnvConfig();
    const merged = this.merge(fileConfig, envConfig, cliOverrides);

    this.config = TolmachConfigSchema.parse(merged);
    return this.config;
  }

  get current(): TolmachConfig {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.config;
  }

  async save(config: Partial<TolmachConfig>): Promise<void> {
    await this.filesystemManager.ensureDir(join(homedir(), ".tolmach"));
    const currentFile = await this.loadFileConfig();
    const merged = { ...currentFile, ...config };
    await this.filesystemManager.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2));
  }

  get configPath(): string {
    return CONFIG_PATH;
  }

  private async loadFileConfig(): Promise<Record<string, unknown>> {
    const exists = await this.filesystemManager.exists(CONFIG_PATH);
    if (!exists) {
      return {};
    }

    const readResult = await this.filesystemManager.readFile(CONFIG_PATH);
    if (!readResult.ok) {
      return {};
    }

    try {
      return JSON.parse(readResult.value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private loadEnvConfig(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const llm: Record<string, unknown> = {};
    if (process.env["LLM_PROVIDER"]) {
      llm["provider"] = process.env["LLM_PROVIDER"];
    }
    if (process.env["LLM_MODEL"]) {
      llm["model"] = process.env["LLM_MODEL"];
    }
    if (process.env["LLM_REPORT_LANGUAGE"]) {
      llm["reportLanguage"] = process.env["LLM_REPORT_LANGUAGE"];
    }
    if (Object.keys(llm).length > 0) {
      result["llm"] = llm;
    }

    const whisper: Record<string, unknown> = {};
    if (process.env["WHISPER_MODEL"]) {
      whisper["model"] = process.env["WHISPER_MODEL"];
    }
    if (process.env["WHISPER_LANGUAGE"]) {
      whisper["language"] = process.env["WHISPER_LANGUAGE"];
    }
    if (process.env["WHISPER_BINARY"]) {
      whisper["binaryPath"] = process.env["WHISPER_BINARY"];
    }
    if (process.env["WHISPER_MODEL_DIR"]) {
      whisper["modelDir"] = process.env["WHISPER_MODEL_DIR"];
    }
    if (Object.keys(whisper).length > 0) {
      result["whisper"] = whisper;
    }

    const output: Record<string, unknown> = {};
    if (process.env["TOLMACH_OUTPUT_DIR"]) {
      output["dir"] = process.env["TOLMACH_OUTPUT_DIR"];
    }
    if (Object.keys(output).length > 0) {
      result["output"] = output;
    }

    const cache: Record<string, unknown> = {};
    if (process.env["TOLMACH_CACHE_DIR"]) {
      cache["dir"] = process.env["TOLMACH_CACHE_DIR"];
    }
    if (process.env["TOLMACH_CACHE_ENABLED"] !== undefined) {
      cache["enabled"] = process.env["TOLMACH_CACHE_ENABLED"] === "true";
    }
    if (Object.keys(cache).length > 0) {
      result["cache"] = cache;
    }

    return result;
  }

  private merge(
    fileConfig: Record<string, unknown>,
    envConfig: Record<string, unknown>,
    cliOverrides?: CliOverrides,
  ): Record<string, unknown> {
    const merged = this.deepMerge(fileConfig, envConfig);

    if (cliOverrides) {
      const llm = (merged["llm"] as Record<string, unknown> | undefined) ?? {};
      if (cliOverrides.llmProvider) {
        llm["provider"] = cliOverrides.llmProvider;
      }
      if (cliOverrides.llmModel) {
        llm["model"] = cliOverrides.llmModel;
      }
      merged["llm"] = llm;

      const whisper = (merged["whisper"] as Record<string, unknown> | undefined) ?? {};
      if (cliOverrides.whisperModel) {
        whisper["model"] = cliOverrides.whisperModel;
      }
      if (cliOverrides.language) {
        whisper["language"] = cliOverrides.language;
      }
      merged["whisper"] = whisper;

      if (cliOverrides.outputDir) {
        const output = (merged["output"] as Record<string, unknown> | undefined) ?? {};
        output["dir"] = cliOverrides.outputDir;
        merged["output"] = output;
      }
    }

    return merged;
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = result[key];

      if (
        sourceVal !== null &&
        typeof sourceVal === "object" &&
        !Array.isArray(sourceVal) &&
        targetVal !== null &&
        typeof targetVal === "object" &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        );
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  }
}
