import { type Result, ok, err } from "../../shared/result.js";
import { VideoError, VIDEO_ERROR_CODE } from "../../shared/errors.js";
import type { VideoProvider } from "./video-provider.interface.js";

export class VideoProviderRegistry {
  private readonly providers: readonly VideoProvider[];

  constructor(providers: readonly VideoProvider[]) {
    this.providers = providers;
  }

  findProvider(url: string): Result<VideoProvider, VideoError> {
    const provider = this.providers.find((p) => p.canHandle(url));

    if (!provider) {
      return err(
        new VideoError(VIDEO_ERROR_CODE.ProviderNotFound, `No provider found for URL: ${url}`),
      );
    }

    return ok(provider);
  }

  get registeredProviders(): readonly string[] {
    return this.providers.map((p) => p.name);
  }
}
