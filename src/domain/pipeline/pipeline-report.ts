import type { VideoMetadata } from "../video/video-metadata.js";
import type { LlmResponse } from "../llm/llm-response.js";

export class PipelineReport {
  readonly content: string;
  readonly metadata: VideoMetadata;
  readonly llmResponse: LlmResponse;
  readonly generatedAt: Date;

  constructor(params: {
    content: string;
    metadata: VideoMetadata;
    llmResponse: LlmResponse;
  }) {
    this.content = params.content;
    this.metadata = params.metadata;
    this.llmResponse = params.llmResponse;
    this.generatedAt = new Date();
  }

  toMarkdown(): string {
    const header = `# ${this.metadata.title}

> **Автор:** ${this.metadata.author}
> **Длительность:** ${this.metadata.formattedDuration}
> **Источник:** ${this.metadata.url}
> **Модель:** ${this.llmResponse.model} (${this.llmResponse.provider})
> **Дата генерации:** ${this.generatedAt.toISOString().split("T")[0]}

---

`;
    return header + this.content;
  }

  get outputFileName(): string {
    const slug = this.metadata.title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/giu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    const date = this.generatedAt.toISOString().split("T")[0];
    return `${date}-${slug}.md`;
  }
}
