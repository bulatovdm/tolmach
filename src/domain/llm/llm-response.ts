export class LlmResponse {
  readonly content: string;
  readonly model: string;
  readonly provider: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly durationMs: number;

  constructor(params: {
    content: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    durationMs: number;
  }) {
    if (!params.content.trim()) {
      throw new Error("LLM response content must not be empty");
    }
    if (!params.provider.trim()) {
      throw new Error("Provider must not be empty");
    }

    this.content = params.content;
    this.model = params.model;
    this.provider = params.provider;
    this.inputTokens = params.inputTokens;
    this.outputTokens = params.outputTokens;
    this.costUsd = params.costUsd;
    this.durationMs = params.durationMs;
  }

  get totalTokens(): number {
    return this.inputTokens + this.outputTokens;
  }
}
