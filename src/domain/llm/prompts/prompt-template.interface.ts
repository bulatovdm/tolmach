import type { PromptContext } from "./prompt-context.js";

export interface PromptTemplate {
  readonly name: string;
  render(context: PromptContext): string;
}
