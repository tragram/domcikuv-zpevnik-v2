// Shared client/server contract: available models and prompt versions for
// illustration generation. The generator itself (src/worker/helpers/image-generator.ts)
// stays server-only; client code imports these lists to render pickers.

// the first element of each array is used as default by the frontend
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
  "gpt-5-mini",
  "gpt-5.2",
] as const;

export const IMAGE_MODELS_API = [
  "nano-banana-2",
  "FLUX.1-dev",
  "FLUX.1-schnell",
  "FLUX.2-dev",
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "nano-banana-pro",
] as const;

export type SummaryPromptVersion = (typeof SUMMARY_PROMPT_VERSIONS)[number];
export type AvailableSummaryModel = (typeof SUMMARY_MODELS_API)[number];
export type AvailableImageModel = (typeof IMAGE_MODELS_API)[number];
