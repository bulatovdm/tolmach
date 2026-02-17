import { describe, it, expect } from "vitest";
import { LlmResponse } from "./llm-response.js";

describe("LlmResponse", () => {
  const validParams = {
    content: "Test response",
    model: "claude-sonnet-4-5",
    provider: "claude-agent",
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.001,
    durationMs: 500,
  };

  it("creates a valid response", () => {
    const response = new LlmResponse(validParams);
    expect(response.content).toBe("Test response");
    expect(response.model).toBe("claude-sonnet-4-5");
    expect(response.provider).toBe("claude-agent");
    expect(response.inputTokens).toBe(100);
    expect(response.outputTokens).toBe(50);
    expect(response.costUsd).toBe(0.001);
    expect(response.durationMs).toBe(500);
  });

  it("calculates totalTokens", () => {
    const response = new LlmResponse(validParams);
    expect(response.totalTokens).toBe(150);
  });

  it("throws on empty content", () => {
    expect(() => new LlmResponse({ ...validParams, content: "   " })).toThrow(
      "LLM response content must not be empty",
    );
  });

  it("throws on empty provider", () => {
    expect(() => new LlmResponse({ ...validParams, provider: "  " })).toThrow(
      "Provider must not be empty",
    );
  });

  it("handles zero tokens", () => {
    const response = new LlmResponse({
      ...validParams,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(response.totalTokens).toBe(0);
  });
});
