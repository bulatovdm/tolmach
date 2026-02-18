import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLM_ERROR_CODE } from "../../../shared/errors.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

import { ClaudeAgentProvider } from "./claude-agent.provider.js";
import { query } from "@anthropic-ai/claude-agent-sdk";

const mockQuery = vi.mocked(query);

function createMockAsyncGenerator(messages: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve();
      for (const msg of messages) {
        yield msg;
      }
    },
  };
}

describe("ClaudeAgentProvider", () => {
  const provider = new ClaudeAgentProvider();

  beforeEach(() => {
    delete process.env["CLAUDECODE"];
  });

  afterEach(() => {
    delete process.env["CLAUDECODE"];
  });

  it("has correct name", () => {
    expect(provider.name).toBe("claude-agent");
  });

  it("returns successful response", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        { type: "system", subtype: "init" },
        {
          type: "result",
          subtype: "success",
          result: "Generated report content",
          usage: { input_tokens: 500, output_tokens: 200 },
          total_cost_usd: 0.003,
        },
      ]) as ReturnType<typeof query>,
    );

    const result = await provider.complete("Test prompt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe("Generated report content");
      expect(result.value.provider).toBe("claude-agent");
      expect(result.value.inputTokens).toBe(500);
      expect(result.value.outputTokens).toBe(200);
      expect(result.value.costUsd).toBe(0.003);
    }
  });

  it("uses custom model", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        {
          type: "result",
          subtype: "success",
          result: "Response",
          usage: { input_tokens: 100, output_tokens: 50 },
          total_cost_usd: 0.001,
        },
      ]) as ReturnType<typeof query>,
    );

    const result = await provider.complete("Prompt", { model: "claude-opus-4-6" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.model).toBe("claude-opus-4-6");
    }

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options: expect.objectContaining({ model: "claude-opus-4-6" }),
      }),
    );
  });

  it("returns error on SDK failure", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        {
          type: "result",
          subtype: "error_max_turns",
          errors: ["Max turns exceeded"],
        },
      ]) as ReturnType<typeof query>,
    );

    const result = await provider.complete("Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.CompletionFailed);
      expect(result.error.message).toContain("error_max_turns");
    }
  });

  it("returns error on empty result", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        {
          type: "result",
          subtype: "success",
          result: "   ",
          usage: { input_tokens: 100, output_tokens: 0 },
          total_cost_usd: 0,
        },
      ]) as ReturnType<typeof query>,
    );

    const result = await provider.complete("Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.EmptyResponse);
    }
  });

  it("returns error when no result message received", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        { type: "system", subtype: "init" },
      ]) as ReturnType<typeof query>,
    );

    const result = await provider.complete("Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.EmptyResponse);
    }
  });

  it("handles thrown exceptions", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("Connection failed");
    });

    const result = await provider.complete("Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.CompletionFailed);
      expect(result.error.message).toContain("Connection failed");
    }
  });

  it("returns error when running inside Claude Code session", async () => {
    process.env["CLAUDECODE"] = "1";

    const result = await provider.complete("Test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(LLM_ERROR_CODE.CompletionFailed);
      expect(result.error.message).toContain("Claude Code session");
    }
  });

  it("passes system prompt to SDK", async () => {
    mockQuery.mockReturnValue(
      createMockAsyncGenerator([
        {
          type: "result",
          subtype: "success",
          result: "Response",
          usage: { input_tokens: 100, output_tokens: 50 },
          total_cost_usd: 0.001,
        },
      ]) as ReturnType<typeof query>,
    );

    await provider.complete("Prompt", { systemPrompt: "Custom system" });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        options: expect.objectContaining({ systemPrompt: "Custom system" }),
      }),
    );
  });
});
