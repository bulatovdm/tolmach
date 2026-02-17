import { z } from "zod";

export const TolmachConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["claude-code", "openai", "ollama"]).default("claude-code"),
    model: z.string().optional(),
    maxTokens: z.number().int().positive().default(4096),
    temperature: z.number().min(0).max(2).default(0),
  }),
  whisper: z.object({
    model: z.string().default("large-v3-turbo"),
    language: z.string().default("auto"),
    binaryPath: z.string().default("whisper-cli"),
    modelPath: z.string().optional(),
  }),
  output: z.object({
    dir: z.string().default("~/.tolmach/reports"),
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
    dir: z.string().default("~/.tolmach/cache"),
  }),
  temp: z.object({
    dir: z.string().default("~/.tolmach/tmp"),
  }),
});

export type TolmachConfig = z.infer<typeof TolmachConfigSchema>;

export const DEFAULT_CONFIG: TolmachConfig = TolmachConfigSchema.parse({
  llm: {},
  whisper: {},
  output: {},
  cache: {},
  temp: {},
});
