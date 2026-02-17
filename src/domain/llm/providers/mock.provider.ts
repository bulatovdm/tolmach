import { ok } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";
import type { LlmError } from "../../../shared/errors.js";
import { LlmResponse } from "../llm-response.js";
import type { LlmProvider, LlmCompletionOptions } from "../llm-provider.interface.js";

export interface MockCall {
  readonly prompt: string;
  readonly options?: LlmCompletionOptions | undefined;
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  private readonly response: string;
  private readonly _calls: MockCall[] = [];

  constructor(response: string = "Mock LLM response") {
    this.response = response;
  }

  get calls(): readonly MockCall[] {
    return this._calls;
  }

  complete(
    prompt: string,
    options?: LlmCompletionOptions,
  ): Promise<Result<LlmResponse, LlmError>> {
    this._calls.push({ prompt, options });

    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(this.response.length / 4);

    return Promise.resolve(ok(
      new LlmResponse({
        content: this.response,
        model: options?.model ?? "mock-model",
        provider: this.name,
        inputTokens,
        outputTokens,
        costUsd: 0,
        durationMs: 1,
      }),
    ));
  }
}
