import { describe, it, expect } from "vitest";
import { ok, err, mapResult, flatMapResult } from "./result.js";

describe("Result", () => {
  describe("ok", () => {
    it("creates a successful result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it("works with string values", () => {
      const result = ok("hello");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("hello");
      }
    });
  });

  describe("err", () => {
    it("creates a failed result", () => {
      const result = err("something went wrong");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("something went wrong");
      }
    });

    it("works with Error objects", () => {
      const error = new Error("failure");
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("mapResult", () => {
    it("maps value when result is ok", () => {
      const result = ok(5);
      const mapped = mapResult(result, (v) => v * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it("passes error through when result is err", () => {
      const result = err("fail");
      const mapped = mapResult(result, (v: number) => v * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe("fail");
      }
    });
  });

  describe("flatMapResult", () => {
    it("chains successful results", () => {
      const result = ok(10);
      const chained = flatMapResult(result, (v) => (v > 5 ? ok(v.toString()) : err("too small")));
      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe("10");
      }
    });

    it("returns error from inner function", () => {
      const result = ok(3);
      const chained = flatMapResult(result, (v) => (v > 5 ? ok(v.toString()) : err("too small")));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe("too small");
      }
    });

    it("passes outer error through", () => {
      const result = err("outer fail");
      const chained = flatMapResult(result, (v: number) => ok(v * 2));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe("outer fail");
      }
    });
  });
});
