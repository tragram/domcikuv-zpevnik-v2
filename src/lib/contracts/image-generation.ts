// Shared client/server contract: available models and prompt versions for
// illustration generation. The generator itself (src/worker/helpers/image-generator.ts)
// stays server-only; client code imports these lists to render pickers.

export const SUMMARY_PROMPT_VERSIONS = [
  "v7",
  "v6",
  "v5",
  "v4",
  "v3",
  "v2",
  "v1",
] as const;
export const SUMMARY_MODELS_API = [
  "gpt-5.4-mini",
  "gpt-6-luna",
  "gpt-6.1-terra",
  "gpt-5.2",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
] as const;

export const IMAGE_MODELS_API = [
  "nano-banana-2",
  "gpt-image-2.6-sunburst",
  "gpt-image-2.6-flare",
  "FLUX.1-dev",
  "FLUX.1-schnell",
  "FLUX.2-dev",
  "nano-banana-pro",
] as const;

export type SummaryPromptVersion = (typeof SUMMARY_PROMPT_VERSIONS)[number];
export type AvailableSummaryModel = (typeof SUMMARY_MODELS_API)[number];
export type AvailableImageModel = (typeof IMAGE_MODELS_API)[number];

export interface IllustrationDefaults {
  summaryModel: AvailableSummaryModel;
  imageModel: AvailableImageModel;
}

export const DEFAULT_ILLUSTRATION_MODELS = {
  summaryModel: "gpt-5.4-mini",
  imageModel: "nano-banana-2",
} as const satisfies IllustrationDefaults;
