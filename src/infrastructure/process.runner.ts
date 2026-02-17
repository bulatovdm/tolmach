import { execa, type ResultPromise } from "execa";
import { type Result, ok, err } from "../shared/result.js";
import type { ProgressCallback } from "../shared/types.js";
import { Logger } from "./logger.js";

export interface ProcessOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export class ProcessError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly stderr: string,
    cause?: Error,
  ) {
    super(`Command "${command}" failed with exit code ${exitCode}: ${stderr}`);
    this.name = "ProcessError";
    this.cause = cause;
  }
}

export class ProcessRunner {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger("ProcessRunner");
  }

  async run(
    command: string,
    args: readonly string[],
    options?: { cwd?: string; timeout?: number },
  ): Promise<Result<ProcessOutput, ProcessError>> {
    this.logger.debug(`Running: ${command} ${args.join(" ")}`);

    try {
      const execaOptions: Record<string, unknown> = { reject: false };
      if (options?.cwd) {
        execaOptions["cwd"] = options.cwd;
      }
      if (options?.timeout) {
        execaOptions["timeout"] = options.timeout;
      }

      const result = await execa(command, [...args], execaOptions);
      const stdout = (result.stdout as string | undefined) ?? "";
      const stderr = (result.stderr as string | undefined) ?? "";

      if (result.exitCode !== 0) {
        return err(
          new ProcessError(command, result.exitCode ?? 1, stderr),
        );
      }

      return ok({
        stdout,
        stderr,
        exitCode: result.exitCode ?? 0,
      });
    } catch (error) {
      return err(
        new ProcessError(
          command,
          1,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async runWithProgress(
    command: string,
    args: readonly string[],
    parseProgress: (line: string) => number | undefined,
    onProgress: ProgressCallback,
    options?: { cwd?: string; timeout?: number },
  ): Promise<Result<ProcessOutput, ProcessError>> {
    this.logger.debug(`Running with progress: ${command} ${args.join(" ")}`);

    try {
      const execaOptions: Record<string, unknown> = {
        reject: false,
        stdout: "pipe",
        stderr: "pipe",
      };
      if (options?.cwd) {
        execaOptions["cwd"] = options.cwd;
      }
      if (options?.timeout) {
        execaOptions["timeout"] = options.timeout;
      }

      const subprocess: ResultPromise = execa(command, [...args], execaOptions);

      let lastStdout = "";
      let lastStderr = "";

      if (subprocess.stdout) {
        subprocess.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          lastStdout += text;
          for (const line of text.split("\n")) {
            const percent = parseProgress(line);
            if (percent !== undefined) {
              onProgress({ stage: command, status: "progress", percent });
            }
          }
        });
      }

      if (subprocess.stderr) {
        subprocess.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          lastStderr += text;
          for (const line of text.split("\n")) {
            const percent = parseProgress(line);
            if (percent !== undefined) {
              onProgress({ stage: command, status: "progress", percent });
            }
          }
        });
      }

      const result = await subprocess;

      const resultStdout = (result.stdout as string | undefined) ?? "";
      const resultStderr = (result.stderr as string | undefined) ?? "";

      if (result.exitCode !== 0) {
        return err(
          new ProcessError(command, result.exitCode ?? 1, lastStderr || resultStderr),
        );
      }

      return ok({
        stdout: lastStdout || resultStdout,
        stderr: lastStderr || resultStderr,
        exitCode: result.exitCode ?? 0,
      });
    } catch (error) {
      return err(
        new ProcessError(
          command,
          1,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }
}
