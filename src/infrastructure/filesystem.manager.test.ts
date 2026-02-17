import { describe, it, expect, afterEach } from "vitest";
import { FilesystemManager } from "./filesystem.manager.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, rmdir } from "node:fs/promises";

describe("FilesystemManager", () => {
  const fs = new FilesystemManager();
  const tempFiles: string[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const file of tempFiles) {
      try {
        await unlink(file);
      } catch {
        /* ignore */
      }
    }
    tempFiles.length = 0;

    for (const dir of [...tempDirs].reverse()) {
      try {
        await rmdir(dir);
      } catch {
        /* ignore */
      }
    }
    tempDirs.length = 0;
  });

  describe("readFile", () => {
    it("reads an existing file", async () => {
      const path = join(tmpdir(), `tolmach-test-read-${Date.now()}.txt`);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path, "test content", "utf-8");
      tempFiles.push(path);

      const result = await fs.readFile(path);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("test content");
      }
    });

    it("returns error for non-existent file", async () => {
      const result = await fs.readFile("/nonexistent-path-xyz/file.txt");
      expect(result.ok).toBe(false);
    });
  });

  describe("writeFile", () => {
    it("writes content to a file", async () => {
      const path = join(tmpdir(), `tolmach-test-write-${Date.now()}.txt`);
      tempFiles.push(path);

      const writeResult = await fs.writeFile(path, "written content");
      expect(writeResult.ok).toBe(true);

      const readResult = await fs.readFile(path);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value).toBe("written content");
      }
    });

    it("creates parent directories", async () => {
      const dir = join(tmpdir(), `tolmach-test-dir-${Date.now()}`);
      const path = join(dir, "file.txt");
      tempFiles.push(path);
      tempDirs.push(dir);

      const result = await fs.writeFile(path, "deep content");
      expect(result.ok).toBe(true);
    });
  });

  describe("exists", () => {
    it("returns true for existing file", async () => {
      const path = join(tmpdir(), `tolmach-test-exists-${Date.now()}.txt`);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path, "", "utf-8");
      tempFiles.push(path);

      expect(await fs.exists(path)).toBe(true);
    });

    it("returns false for non-existent file", async () => {
      expect(await fs.exists("/nonexistent-path-xyz/file.txt")).toBe(false);
    });
  });

  describe("resolvePath", () => {
    it("expands tilde to home directory", () => {
      const resolved = fs.resolvePath("~/test");
      expect(resolved).not.toContain("~");
      expect(resolved).toContain("test");
    });

    it("keeps absolute paths unchanged", () => {
      expect(fs.resolvePath("/usr/local")).toBe("/usr/local");
    });
  });
});
