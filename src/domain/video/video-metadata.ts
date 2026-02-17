export class VideoMetadata {
  readonly title: string;
  readonly author: string;
  readonly durationSeconds: number;
  readonly description: string;
  readonly url: string;
  readonly provider: string;

  constructor(params: {
    title: string;
    author: string;
    durationSeconds: number;
    description: string;
    url: string;
    provider: string;
  }) {
    if (!params.title.trim()) {
      throw new Error("Title must not be empty");
    }
    if (params.durationSeconds < 0) {
      throw new Error("Duration must be non-negative");
    }
    if (!params.url.trim()) {
      throw new Error("URL must not be empty");
    }

    this.title = params.title.trim();
    this.author = params.author.trim();
    this.durationSeconds = params.durationSeconds;
    this.description = params.description;
    this.url = params.url;
    this.provider = params.provider;
  }

  get formattedDuration(): string {
    const hours = Math.floor(this.durationSeconds / 3600);
    const minutes = Math.floor((this.durationSeconds % 3600) / 60);
    const seconds = Math.floor(this.durationSeconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
}
