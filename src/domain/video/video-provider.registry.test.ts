import { describe, it, expect } from "vitest";
import { VideoProviderRegistry } from "./video-provider.registry.js";
import type { VideoProvider } from "./video-provider.interface.js";
import type { Result } from "../../shared/result.js";
import type { VideoError } from "../../shared/errors.js";
import type { DownloadedVideo } from "./downloaded-video.js";
import type { VideoMetadata } from "./video-metadata.js";
import type { ProgressCallback } from "../../shared/types.js";

function createMockProvider(name: string, urlPattern: RegExp): VideoProvider {
  return {
    name,
    canHandle: (url: string) => urlPattern.test(url),
    download: (_url: string, _outputDir: string, _onProgress: ProgressCallback): Promise<Result<DownloadedVideo, VideoError>> => {
      throw new Error("not implemented");
    },
    extractMetadata: (_url: string): Promise<Result<VideoMetadata, VideoError>> => {
      throw new Error("not implemented");
    },
  };
}

describe("VideoProviderRegistry", () => {
  const youtubeProvider = createMockProvider("youtube", /youtube\.com|youtu\.be/);
  const vkProvider = createMockProvider("vk", /vk\.com/);

  describe("findProvider", () => {
    it("returns matching provider for YouTube URL", () => {
      const registry = new VideoProviderRegistry([youtubeProvider, vkProvider]);
      const result = registry.findProvider("https://youtube.com/watch?v=abc");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("youtube");
      }
    });

    it("returns matching provider for VK URL", () => {
      const registry = new VideoProviderRegistry([youtubeProvider, vkProvider]);
      const result = registry.findProvider("https://vk.com/video123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("vk");
      }
    });

    it("returns error when no provider matches", () => {
      const registry = new VideoProviderRegistry([youtubeProvider]);
      const result = registry.findProvider("https://example.com/video");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VIDEO_PROVIDER_NOT_FOUND");
      }
    });

    it("returns first matching provider when multiple match", () => {
      const anotherYoutubeProvider = createMockProvider("youtube-alt", /youtube\.com/);
      const registry = new VideoProviderRegistry([youtubeProvider, anotherYoutubeProvider]);
      const result = registry.findProvider("https://youtube.com/watch?v=abc");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe("youtube");
      }
    });

    it("handles empty registry", () => {
      const registry = new VideoProviderRegistry([]);
      const result = registry.findProvider("https://youtube.com/watch?v=abc");
      expect(result.ok).toBe(false);
    });
  });

  describe("registeredProviders", () => {
    it("returns names of all registered providers", () => {
      const registry = new VideoProviderRegistry([youtubeProvider, vkProvider]);
      expect(registry.registeredProviders).toEqual(["youtube", "vk"]);
    });

    it("returns empty array for empty registry", () => {
      const registry = new VideoProviderRegistry([]);
      expect(registry.registeredProviders).toEqual([]);
    });
  });
});
