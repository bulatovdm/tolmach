import type { Result } from "../../shared/result.js";
import type { LlmError } from "../../shared/errors.js";
import type { LlmResponse } from "./llm-response.js";

export interface LlmProvider {
  readonly name: string;

  complete(
    prompt: string,
    options?: LlmCompletionOptions,
  ): Promise<Result<LlmResponse, LlmError>>;
}

export interface LlmCompletionOptions {
  readonly model?: string | undefined;
  readonly maxTokens?: number | undefined;
  readonly temperature?: number | undefined;
  readonly systemPrompt?: string | undefined;
}
