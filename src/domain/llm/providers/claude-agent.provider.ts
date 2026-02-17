import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { LLM_ERROR_CODE, LlmError } from "../../../shared/errors.js";
import { ok, err } from "../../../shared/result.js";
import type { Result } from "../../../shared/result.js";
import { LlmResponse } from "../llm-response.js";
import type { LlmProvider, LlmCompletionOptions } from "../llm-provider.interface.js";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export class ClaudeAgentProvider implements LlmProvider {
  readonly name = "claude-agent";

  async complete(
    prompt: string,
    options?: LlmCompletionOptions,
  ): Promise<Result<LlmResponse, LlmError>> {
    const model = options?.model ?? DEFAULT_MODEL;
    const startTime = Date.now();

    try {
      let resultMessage: SDKResultMessage | undefined;

      const q = query({
        prompt,
        options: {
          model,
          maxTurns: 1,
          systemPrompt: options?.systemPrompt ?? "You are a helpful assistant that analyzes video transcriptions and generates structured reports in Markdown format. Always respond in the same language as the transcription.",
          tools: [],
          permissionMode: "dontAsk",
        },
      });

      for await (const message of q) {
        if (message.type === "result") {
          resultMessage = message;
        }
      }

      if (!resultMessage) {
        return err(
          new LlmError(LLM_ERROR_CODE.EmptyResponse, "No result received from Claude Agent SDK"),
        );
      }

      if (resultMessage.subtype !== "success") {
        const errorMessages = "errors" in resultMessage ? resultMessage.errors.join("; ") : "Unknown error";
        return err(
          new LlmError(
            LLM_ERROR_CODE.CompletionFailed,
            `Claude Agent SDK error (${resultMessage.subtype}): ${errorMessages}`,
          ),
        );
      }

      const content = resultMessage.result.trim();
      if (!content) {
        return err(
          new LlmError(LLM_ERROR_CODE.EmptyResponse, "Empty response from Claude Agent SDK"),
        );
      }

      const durationMs = Date.now() - startTime;

      return ok(
        new LlmResponse({
          content,
          model,
          provider: this.name,
          inputTokens: resultMessage.usage.input_tokens as number,
          outputTokens: resultMessage.usage.output_tokens as number,
          costUsd: resultMessage.total_cost_usd,
          durationMs,
        }),
      );
    } catch (error) {
      return err(
        new LlmError(
          LLM_ERROR_CODE.CompletionFailed,
          `Claude Agent SDK failed: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
