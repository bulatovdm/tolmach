import { LLM_ERROR_CODE, LlmError } from "../../shared/errors.js";
import { err } from "../../shared/result.js";
import type { Result } from "../../shared/result.js";
import type { LlmResponse } from "./llm-response.js";
import type { LlmProvider, LlmCompletionOptions } from "./llm-provider.interface.js";

export class LlmRouter {
  private readonly providers: Map<string, LlmProvider>;
  private readonly defaultProviderName: string;

  constructor(
    providers: readonly LlmProvider[],
    defaultProviderName?: string,
  ) {
    const firstProvider = providers[0];
    if (!firstProvider) {
      throw new Error("At least one LLM provider must be registered");
    }

    this.providers = new Map(providers.map((p) => [p.name, p]));
    this.defaultProviderName = defaultProviderName ?? firstProvider.name;

    if (!this.providers.has(this.defaultProviderName)) {
      throw new Error(`Default provider "${this.defaultProviderName}" not found`);
    }
  }

  async complete(
    prompt: string,
    options?: LlmCompletionOptions & { readonly provider?: string | undefined },
  ): Promise<Result<LlmResponse, LlmError>> {
    const providerName = options?.provider ?? this.defaultProviderName;
    const provider = this.providers.get(providerName);

    if (!provider) {
      return err(
        new LlmError(
          LLM_ERROR_CODE.ProviderNotFound,
          `LLM provider "${providerName}" not found. Available: ${[...this.providers.keys()].join(", ")}`,
        ),
      );
    }

    return provider.complete(prompt, options);
  }

  getProvider(name: string): LlmProvider | undefined {
    return this.providers.get(name);
  }

  get registeredProviders(): readonly string[] {
    return [...this.providers.keys()];
  }
}
