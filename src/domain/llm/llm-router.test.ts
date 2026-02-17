import { describe, it, expect } from "vitest";
import { LlmRouter } from "./llm-router.js";
import { MockLlmProvider } from "./providers/mock.provider.js";
import { LLM_ERROR_CODE, LlmError } from "../../shared/errors.js";
import { err } from "../../shared/result.js";
import type { LlmProvider, LlmCompletionOptions } from "./llm-provider.interface.js";
import type { Result } from "../../shared/result.js";
import type { LlmResponse } from "./llm-response.js";

class FailingProvider implements LlmProvider {
  readonly name = "failing";

  complete(
    _prompt: string,
    _options?: LlmCompletionOptions,
  ): Promise<Result<LlmResponse, LlmError>> {
    return Promise.resolve(err(new LlmError(LLM_ERROR_CODE.CompletionFailed, "Always fails")));
  }
}

describe("LlmRouter", () => {
  it("routes to default provider", async () => {
    const mock = new MockLlmProvider("response A");
    const router = new LlmRouter([mock]);

    const result = await router.complete("Hello");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe("response A");
    }
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.prompt).toBe("Hello");
  });

  it("routes to named provider", async () => {
    const mock1 = new MockLlmProvider("A");
    const failing = new FailingProvider();
    const router = new LlmRouter([mock1, failing], "mock");

    const result = await router.complete("test", { provider: "failing" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.CompletionFailed);
    }
  });

  it("returns error for unknown provider", async () => {
    const mock = new MockLlmProvider();
    const router = new LlmRouter([mock]);

    const result = await router.complete("test", { provider: "nonexistent" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.ProviderNotFound);
      expect(result.error.message).toContain("nonexistent");
    }
  });

  it("throws if no providers registered", () => {
    expect(() => new LlmRouter([])).toThrow("At least one LLM provider must be registered");
  });

  it("throws if default provider not found", () => {
    const mock = new MockLlmProvider();
    expect(() => new LlmRouter([mock], "nonexistent")).toThrow(
      'Default provider "nonexistent" not found',
    );
  });

  it("lists registered providers", () => {
    const mock = new MockLlmProvider();
    const failing = new FailingProvider();
    const router = new LlmRouter([mock, failing]);

    expect(router.registeredProviders).toEqual(["mock", "failing"]);
  });

  it("gets provider by name", () => {
    const mock = new MockLlmProvider();
    const router = new LlmRouter([mock]);

    expect(router.getProvider("mock")).toBe(mock);
    expect(router.getProvider("nonexistent")).toBeUndefined();
  });

  it("uses explicit default provider name", async () => {
    const mock = new MockLlmProvider("mock response");
    const failing = new FailingProvider();
    const router = new LlmRouter([mock, failing], "failing");

    const result = await router.complete("test");
    expect(result.ok).toBe(false);
  });

  it("passes options to provider", async () => {
    const mock = new MockLlmProvider();
    const router = new LlmRouter([mock]);

    await router.complete("test", { model: "custom-model", temperature: 0.5 });
    expect(mock.calls[0]?.options).toEqual(
      expect.objectContaining({ model: "custom-model", temperature: 0.5 }),
    );
  });
});
