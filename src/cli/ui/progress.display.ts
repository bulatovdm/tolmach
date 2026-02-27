import ora, { type Ora } from "ora";
import chalk from "chalk";
import type { ProgressEvent } from "../../shared/types.js";
import { PIPELINE_STAGE } from "../../domain/pipeline/pipeline-event.js";

const STAGE_ICONS: Record<string, string> = {
  [PIPELINE_STAGE.Detect]: "🔍",
  [PIPELINE_STAGE.Download]: "📥",
  [PIPELINE_STAGE.Transcribe]: "🎙 ",
  [PIPELINE_STAGE.Report]: "🤖",
  [PIPELINE_STAGE.Save]: "📄",
};

const STAGE_LABELS: Record<string, string> = {
  [PIPELINE_STAGE.Detect]: "Определение провайдера",
  [PIPELINE_STAGE.Download]: "Скачивание видео",
  [PIPELINE_STAGE.Transcribe]: "Транскрибация",
  [PIPELINE_STAGE.Report]: "Генерация отчёта",
  [PIPELINE_STAGE.Save]: "Сохранение отчёта",
};

const LOCAL_STAGE_LABELS: Partial<Record<string, string>> = {
  [PIPELINE_STAGE.Download]: "Извлечение аудио",
};

export class ProgressDisplay {
  private spinner: Ora;
  private readonly stageTimers: Map<string, number> = new Map();
  private readonly stagePercent: Map<string, number> = new Map();
  private readonly completedStages: string[] = [];
  private providerName: string = "";

  constructor() {
    this.spinner = ora();
  }

  handleProgress(event: ProgressEvent): void {
    const icon = STAGE_ICONS[event.stage] ?? "⏳";
    const overrides = this.providerName === "local" ? LOCAL_STAGE_LABELS : {};
    const label = overrides[event.stage] ?? STAGE_LABELS[event.stage] ?? event.stage;

    switch (event.status) {
      case "started":
        this.stageTimers.set(event.stage, Date.now());
        this.stagePercent.delete(event.stage);
        this.spinner.start(`${icon} ${label}...`);
        break;

      case "progress":
        if (event.percent !== undefined) {
          const prev = this.stagePercent.get(event.stage) ?? 0;
          const current = Math.round(event.percent);
          if (current >= prev) {
            this.stagePercent.set(event.stage, current);
            this.spinner.text = `${icon} ${label}... ${chalk.cyan(`${current}%`)}`;
          }
        }
        break;

      case "completed": {
        if (event.stage === PIPELINE_STAGE.Detect && event.message) {
          this.providerName = event.message;
        }
        const startTime = this.stageTimers.get(event.stage);
        const elapsed = startTime ? Date.now() - startTime : 0;
        const timeStr = this.formatElapsed(elapsed);
        this.spinner.succeed(
          `${icon} ${label} ${chalk.green("✓")} ${chalk.gray(`[${timeStr}]`)}`,
        );
        this.completedStages.push(event.stage);
        break;
      }

      case "failed":
        this.spinner.fail(`${icon} ${label} ${chalk.red("✗")} ${event.message ?? ""}`);
        break;
    }
  }

  showSummary(params: {
    totalDurationMs: number;
    videoDuration: string;
    model: string;
    outputPath: string;
  }): void {
    const totalTime = this.formatElapsed(params.totalDurationMs);
    console.log();
    console.log(
      chalk.gray(
        `Итого: ${totalTime} | Видео: ${params.videoDuration} | Модель: ${params.model}`,
      ),
    );
    const fileLink = this.formatFileLink(params.outputPath);
    console.log(chalk.green(`📄 Отчёт сохранён: ${fileLink}`));
  }

  showError(message: string): void {
    this.spinner.fail(chalk.red(message));
  }

  private formatFileLink(filePath: string): string {
    const fileUrl = `file://${filePath}`;
    return `\x1b]8;;${fileUrl}\x07${filePath}\x1b]8;;\x07`;
  }

  private formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }
}
