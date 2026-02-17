export type { ProgressEvent, ProgressCallback, ProgressStatus } from "../../shared/types.js";

export const PIPELINE_STAGE = {
  Detect: "detect",
  Download: "download",
  Transcribe: "transcribe",
  Report: "report",
  Save: "save",
} as const;

export type PipelineStageName = (typeof PIPELINE_STAGE)[keyof typeof PIPELINE_STAGE];
