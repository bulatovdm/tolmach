import { describe, it, expect, vi } from "vitest";
import { ProcessRunner } from "./process.runner.js";

describe("ProcessRunner", () => {
  const runner = new ProcessRunner();

  describe("run", () => {
    it("executes a command and returns stdout", async () => {
      const result = await runner.run("echo", ["hello"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stdout.trim()).toBe("hello");
        expect(result.value.exitCode).toBe(0);
      }
    });

    it("returns error for non-existent command", async () => {
      const result = await runner.run("nonexistent-command-xyz", []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.command).toBe("nonexistent-command-xyz");
      }
    });

    it("returns error for failing command", async () => {
      const result = await runner.run("ls", ["/nonexistent-path-xyz"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.exitCode).not.toBe(0);
      }
    });
  });

  describe("runWithProgress", () => {
    it("parses progress from stdout", async () => {
      const progressEvents: number[] = [];
      const parseProgress = (line: string): number | undefined => {
        const match = /(\d+)/.exec(line);
        return match?.[1] !== undefined ? parseInt(match[1], 10) : undefined;
      };

      const result = await runner.runWithProgress(
        "printf",
        ["10\\n50\\n100\\n"],
        parseProgress,
        (event) => {
          if (event.percent !== undefined) {
            progressEvents.push(event.percent);
          }
        },
      );

      expect(result.ok).toBe(true);
      expect(progressEvents).toContain(10);
      expect(progressEvents).toContain(50);
      expect(progressEvents).toContain(100);
    });

    it("calls onProgress callback", async () => {
      const onProgress = vi.fn();

      await runner.runWithProgress(
        "echo",
        ["42"],
        (line) => {
          const match = /(\d+)/.exec(line);
          return match?.[1] !== undefined ? parseInt(match[1], 10) : undefined;
        },
        onProgress,
      );

      expect(onProgress).toHaveBeenCalled();
    });
  });
});
