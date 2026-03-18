import type { PromptTemplate } from "./prompt-template.interface.js";
import type { PromptContext } from "./prompt-context.js";

export class VideoReportPrompt implements PromptTemplate {
  readonly name = "video-report";

  render(context: PromptContext): string {
    const { metadata, transcription, reportLanguage } = context;

    const languageInstruction = reportLanguage === "auto"
      ? "Создай отчёт на том же языке, что и транскрипция"
      : `Создай отчёт на языке: ${reportLanguage}`;

    const scale = this.getDetailScale(metadata.durationSeconds);

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

${languageInstruction}, со следующей структурой:

1. **Краткое содержание** (${scale.summarySentences}) — основная суть видео
2. **Ключевые темы** — маркированный список основных тем/разделов${scale.topicsHint}
3. **Основные тезисы** — нумерованный список ключевых идей и выводов${scale.thesesHint}
4. **Цитаты** — ${scale.quotes} наиболее значимых цитат из транскрипции (дословно)
5. **Заключение** — ${scale.conclusionHint}

${scale.depthInstruction} Не добавляй информацию, которой нет в транскрипции.`;
  }

  private getDetailScale(durationSeconds: number): DetailScale {
    if (durationSeconds <= 900) {
      return SHORT_VIDEO_SCALE;
    }
    if (durationSeconds <= 2700) {
      return MEDIUM_VIDEO_SCALE;
    }
    return LONG_VIDEO_SCALE;
  }
}

interface DetailScale {
  readonly summarySentences: string;
  readonly topicsHint: string;
  readonly thesesHint: string;
  readonly quotes: string;
  readonly conclusionHint: string;
  readonly depthInstruction: string;
}

const SHORT_VIDEO_SCALE: DetailScale = {
  summarySentences: "3–5 предложений",
  topicsHint: "",
  thesesHint: "",
  quotes: "3–5",
  conclusionHint: "краткий итог и основной вывод",
  depthInstruction: "Пиши ёмко, но информативно.",
};

const MEDIUM_VIDEO_SCALE: DetailScale = {
  summarySentences: "5–8 предложений",
  topicsHint: ", раскрой каждую тему 1–2 предложениями",
  thesesHint: " (8–15 тезисов)",
  quotes: "5–8",
  conclusionHint: "развёрнутый итог с основными выводами (3–5 предложений)",
  depthInstruction: "Видео средней длительности — дай достаточно подробный анализ, раскрывая каждую тему.",
};

const LONG_VIDEO_SCALE: DetailScale = {
  summarySentences: "8–12 предложений",
  topicsHint: ", раскрой каждую тему 2–3 предложениями с подпунктами при необходимости",
  thesesHint: " (15–25 тезисов)",
  quotes: "8–12",
  conclusionHint: "развёрнутый итог с ключевыми выводами и рекомендациями (5–8 предложений)",
  depthInstruction: "Это длинное видео — создай подробный и глубокий анализ, пропорциональный объёму материала. Не упускай важные детали и нюансы.",
};
