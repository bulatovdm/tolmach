import type { PromptTemplate } from "./prompt-template.interface.js";
import type { PromptContext } from "./prompt-context.js";

export class VideoReportPrompt implements PromptTemplate {
  readonly name = "video-report";

  render(context: PromptContext): string {
    const { metadata, transcription } = context;

    return `Ты — аналитик видеоконтента. Проанализируй транскрипцию видео и создай структурированный отчёт в формате Markdown.

## Информация о видео

- **Название:** ${metadata.title}
- **Автор:** ${metadata.author}
- **Длительность:** ${metadata.formattedDuration}
- **URL:** ${metadata.url}
- **Язык транскрипции:** ${transcription.language}
- **Уверенность транскрипции:** ${Math.round(transcription.averageConfidence * 100)}%

## Транскрипция

${transcription.fullText}

---

## Инструкции

Создай отчёт на том же языке, что и транскрипция, со следующей структурой:

1. **Краткое содержание** (3–5 предложений) — основная суть видео
2. **Ключевые темы** — маркированный список основных тем/разделов
3. **Основные тезисы** — нумерованный список ключевых идей и выводов
4. **Цитаты** — 3–5 наиболее значимых цитат из транскрипции (дословно)
5. **Заключение** — краткий итог и основной вывод

Пиши ёмко, но информативно. Не добавляй информацию, которой нет в транскрипции.`;
  }
}
