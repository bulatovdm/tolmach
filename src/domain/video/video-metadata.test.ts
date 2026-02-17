import { describe, it, expect } from "vitest";
import { VideoMetadata } from "./video-metadata.js";

describe("VideoMetadata", () => {
  const validParams = {
    title: "Test Video",
    author: "Author",
    durationSeconds: 754,
    description: "A test video",
    url: "https://youtube.com/watch?v=abc",
    provider: "youtube",
  };

  it("creates with valid params", () => {
    const metadata = new VideoMetadata(validParams);
    expect(metadata.title).toBe("Test Video");
    expect(metadata.author).toBe("Author");
    expect(metadata.durationSeconds).toBe(754);
    expect(metadata.url).toBe("https://youtube.com/watch?v=abc");
  });

  it("trims title and author", () => {
    const metadata = new VideoMetadata({ ...validParams, title: "  Spaced  ", author: "  Trim  " });
    expect(metadata.title).toBe("Spaced");
    expect(metadata.author).toBe("Trim");
  });

  it("throws on empty title", () => {
    expect(() => new VideoMetadata({ ...validParams, title: "" })).toThrow("Title must not be empty");
  });

  it("throws on whitespace-only title", () => {
    expect(() => new VideoMetadata({ ...validParams, title: "   " })).toThrow("Title must not be empty");
  });

  it("throws on negative duration", () => {
    expect(() => new VideoMetadata({ ...validParams, durationSeconds: -1 })).toThrow(
      "Duration must be non-negative",
    );
  });

  it("throws on empty URL", () => {
    expect(() => new VideoMetadata({ ...validParams, url: "" })).toThrow("URL must not be empty");
  });

  describe("formattedDuration", () => {
    it("formats seconds only", () => {
      const metadata = new VideoMetadata({ ...validParams, durationSeconds: 45 });
      expect(metadata.formattedDuration).toBe("0:45");
    });

    it("formats minutes and seconds", () => {
      const metadata = new VideoMetadata({ ...validParams, durationSeconds: 754 });
      expect(metadata.formattedDuration).toBe("12:34");
    });

    it("formats hours, minutes, and seconds", () => {
      const metadata = new VideoMetadata({ ...validParams, durationSeconds: 3661 });
      expect(metadata.formattedDuration).toBe("1:01:01");
    });

    it("formats zero duration", () => {
      const metadata = new VideoMetadata({ ...validParams, durationSeconds: 0 });
      expect(metadata.formattedDuration).toBe("0:00");
    });
  });
});
