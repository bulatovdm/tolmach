export type ProgressStatus = "started" | "progress" | "completed" | "failed";

export interface ProgressEvent {
  readonly stage: string;
  readonly status: ProgressStatus;
  readonly percent?: number | undefined;
  readonly message?: string | undefined;
  readonly elapsed?: number | undefined;
}

export type ProgressCallback = (event: ProgressEvent) => void;
