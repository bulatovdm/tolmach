import { readFile, writeFile, mkdir, rm, stat, access } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { type Result, ok, err } from "../shared/result.js";

export class FilesystemError extends Error {
  constructor(
    readonly path: string,
    message: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "FilesystemError";
    this.cause = cause;
  }
}

export class FilesystemManager {
  async readFile(path: string): Promise<Result<string, FilesystemError>> {
    try {
      const content = await readFile(path, "utf-8");
      return ok(content);
    } catch (error) {
      return err(
        new FilesystemError(
          path,
          `Failed to read file: ${path}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async writeFile(path: string, content: string): Promise<Result<void, FilesystemError>> {
    try {
      await this.ensureDir(dirname(path));
      await writeFile(path, content, "utf-8");
      return ok(undefined);
    } catch (error) {
      return err(
        new FilesystemError(
          path,
          `Failed to write file: ${path}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async fileSize(path: string): Promise<Result<number, FilesystemError>> {
    try {
      const stats = await stat(path);
      return ok(stats.size);
    } catch (error) {
      return err(
        new FilesystemError(
          path,
          `Failed to get file size: ${path}`,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async removeDir(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true }).catch(() => {});
  }

  resolvePath(path: string): string {
    if (path.startsWith("~/")) {
      return path.replace("~", homedir());
    }
    return path;
  }
}
