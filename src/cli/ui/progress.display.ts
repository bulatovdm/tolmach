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

export class ProgressDisplay {
  private spinner: Ora;
  private readonly stageTimers: Map<string, number> = new Map();
  private readonly completedStages: string[] = [];

  constructor() {
    this.spinner = ora();
  }

  handleProgress(event: ProgressEvent): void {
    const icon = STAGE_ICONS[event.stage] ?? "⏳";
    const label = STAGE_LABELS[event.stage] ?? event.stage;

    switch (event.status) {
      case "started":
        this.stageTimers.set(event.stage, Date.now());
        this.spinner.start(`${icon} ${label}...`);
        break;

      case "progress":
        if (event.percent !== undefined) {
          this.spinner.text = `${icon} ${label}... ${chalk.cyan(`${Math.round(event.percent)}%`)}`;
        }
        break;

      case "completed": {
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
    console.log(chalk.green(`📄 Отчёт сохранён: ${params.outputPath}`));
  }

  showError(message: string): void {
    this.spinner.fail(chalk.red(message));
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
