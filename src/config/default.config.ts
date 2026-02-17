import { z } from "zod";

const LlmSchema = z.object({
  provider: z.enum(["claude-agent", "mock"]).default("claude-agent"),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0),
  reportLanguage: z.string().default("ru"),
});

const WhisperSchema = z.object({
  model: z.string().default("large-v3-turbo"),
  language: z.string().default("auto"),
  binaryPath: z.string().default("whisper-cli"),
  modelDir: z.string().default("~/.tolmach/models"),
});

const OutputSchema = z.object({
  dir: z.string().default("~/.tolmach/reports"),
});

const CacheSchema = z.object({
  enabled: z.boolean().default(true),
  dir: z.string().default("~/.tolmach/cache"),
});

const TempSchema = z.object({
  dir: z.string().default("~/.tolmach/tmp"),
});

export const TolmachConfigSchema = z.object({
  llm: LlmSchema.default(LlmSchema.parse({})),
  whisper: WhisperSchema.default(WhisperSchema.parse({})),
  output: OutputSchema.default(OutputSchema.parse({})),
  cache: CacheSchema.default(CacheSchema.parse({})),
  temp: TempSchema.default(TempSchema.parse({})),
});

export type TolmachConfig = z.infer<typeof TolmachConfigSchema>;

export const DEFAULT_CONFIG: TolmachConfig = TolmachConfigSchema.parse({});
