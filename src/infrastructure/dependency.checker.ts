import type { ProcessRunner } from "./process.runner.js";

export interface DependencyStatus {
  readonly name: string;
  readonly available: boolean;
  readonly version?: string | undefined;
}

const REQUIRED_DEPENDENCIES = [
  { name: "yt-dlp", command: "yt-dlp", args: ["--version"] },
  { name: "ffmpeg", command: "ffmpeg", args: ["-version"] },
  { name: "whisper-cli", command: "whisper-cli", args: ["--help"] },
] as const;

export class DependencyChecker {
  constructor(private readonly processRunner: ProcessRunner) {}

  async checkAll(): Promise<readonly DependencyStatus[]> {
    return Promise.all(
      REQUIRED_DEPENDENCIES.map((dep) => this.check(dep.name, dep.command, dep.args)),
    );
  }

  async check(name: string, command: string, args: readonly string[]): Promise<DependencyStatus> {
    const result = await this.processRunner.run(command, args);

    if (!result.ok) {
      return { name, available: false };
    }

    const version = result.value.stdout.split("\n")[0]?.trim();
    return { name, available: true, version };
  }

  async ensureRequired(): Promise<readonly DependencyStatus[]> {
    const statuses = await this.checkAll();
    const missing = statuses.filter((s) => !s.available);

    if (missing.length > 0) {
      const names = missing.map((s) => s.name).join(", ");
      throw new Error(
        `Missing required dependencies: ${names}. Install them before using tolmach.`,
      );
    }

    return statuses;
  }
}
