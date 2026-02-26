import { InferenceClient } from "@huggingface/inference";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// the first element of each array is used as default by the frontend
export const SUMMARY_PROMPT_VERSIONS = ["v3", "v2", "v1"] as const;
export const SUMMARY_MODELS_API = ["gpt-5-mini", "gpt-5.2"] as const;

export const IMAGE_MODELS_API = [
  "FLUX.1-dev",
  "FLUX.1-schnell",
  "FLUX.2-dev",
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "nano-banana-pro",
  "nano-banana-2",
] as const;

export type SummaryPromptVersion = (typeof SUMMARY_PROMPT_VERSIONS)[number];
export type AvailableSummaryModel = (typeof SUMMARY_MODELS_API)[number];
export type AvailableImageModel = (typeof IMAGE_MODELS_API)[number];

const PROMPTS: Record<SummaryPromptVersion, string> = {
  v1: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short",
  v2: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short but also to capture a concrete scene/idea from the song.",
  v3: "Based on the following song lyrics, create a prompt for an AI image generator. Try to be short but also to capture a concrete scene/idea from the song. The image will be used as an illustration of the song in a database, so do not aim for photo realistic unless it fits the lyrics perfectly.",
} as const;

export type ImageProviderType = "openai" | "huggingface" | "google";

// Easily map models to their respective providers
export const MODEL_PROVIDERS: Record<AvailableImageModel, ImageProviderType> = {
  "FLUX.1-dev": "huggingface",
  "FLUX.1-schnell": "huggingface",
  "FLUX.2-dev": "huggingface",
  "gpt-image-1.5": "openai",
  "gpt-image-1": "openai",
  "gpt-image-1-mini": "openai",
  "nano-banana-pro": "google",
  "nano-banana-2": "google",
};

// Map generic model names to provider-specific endpoints/tags
const PROVIDER_MODEL_NAMES: Partial<Record<AvailableImageModel, string>> = {
  "FLUX.1-dev": "black-forest-labs/FLUX.1-dev",
  "FLUX.1-schnell": "black-forest-labs/FLUX.1-schnell",
  "FLUX.2-dev": "black-forest-labs/FLUX.2-dev",
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
};

export interface GenerationConfig {
  promptVersion: SummaryPromptVersion;
  summaryModel: AvailableSummaryModel;
  imageModel: AvailableImageModel;
  openaiApiKey: string;
  huggingFaceToken?: string;
  googleApiKey?: string;
  openaiOrgId?: string;
  openaiProjectId?: string;
}

export interface GenerationResult {
  prompt: string;
  imageBuffer: ArrayBuffer;
  thumbnailBuffer: ArrayBuffer;
}
declare global {
  interface Uint8ArrayConstructor {
    fromBase64(string: string): Uint8Array;
  }
}
// --- Image Provider Interfaces & Implementations ---

interface ImageProvider {
  generate(
    prompt: string,
    model: string,
    config: GenerationConfig,
  ): Promise<ArrayBuffer>;
}

class OpenAIImageProvider implements ImageProvider {
  async generate(
    prompt: string,
    model: string,
    config: GenerationConfig,
  ): Promise<ArrayBuffer> {
    const openai = new OpenAI({
      apiKey: config.openaiApiKey,
      organization: config.openaiOrgId,
      project: config.openaiProjectId,
    });

    const response = await openai.images.generate({
      model: model,
      prompt,
      size: "1024x1024",
    });

    const base64 = response.data[0].b64_json;
    if (!base64) {
      throw new Error("No image data returned from OpenAI");
    }

    // Native fast decode using V8
    const uint8Array = Uint8Array.fromBase64(base64);
    return uint8Array.buffer;
  }
}

class HuggingFaceImageProvider implements ImageProvider {
  async generate(
    prompt: string,
    model: string,
    config: GenerationConfig,
  ): Promise<ArrayBuffer> {
    if (!config.huggingFaceToken)
      throw new Error("Hugging Face token is required");

    const client = new InferenceClient(config.huggingFaceToken);
    const hfModel = PROVIDER_MODEL_NAMES[model as AvailableImageModel] || model;

    const imageBlob = await client.textToImage({
      model: hfModel,
      inputs: prompt,
      provider: "replicate",
      parameters: { width: 512, height: 512 },
    });

    return await (imageBlob as unknown as Blob).arrayBuffer();
  }
}

class GoogleImageProvider implements ImageProvider {
  async generate(
    prompt: string,
    model: string,
    config: GenerationConfig,
  ): Promise<ArrayBuffer> {
    if (!config.googleApiKey) throw new Error("Google API key is required");

    const ai = new GoogleGenAI({ apiKey: config.googleApiKey });
    const googleModel =
      PROVIDER_MODEL_NAMES[model as AvailableImageModel] || model;

    const response = await ai.models.generateContent({
      model: googleModel,
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          // imageSize: "512x512", //TODO: banana pro 2 should support lower than 1K resolution but the library does not yet...
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: any) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      throw new Error("No image data returned from Google API");
    }

    // Native fast decode using V8
    const base64 = imagePart.inlineData.data;
    const uint8Array = Uint8Array.fromBase64(base64);
    return uint8Array.buffer;
  }
}

export class ImageGenerator {
  private config: GenerationConfig;
  private providers: Record<ImageProviderType, ImageProvider>;

  constructor(config: GenerationConfig) {
    this.config = config;
    this.providers = {
      openai: new OpenAIImageProvider(),
      huggingface: new HuggingFaceImageProvider(),
      google: new GoogleImageProvider(),
    };
  }

  /**
   * Extract lyrics from ChordPro format
   */
  static extractLyricsFromChordPro(chordproContent: string): string {
    return chordproContent
      .split("\n")
      .filter(
        (line) =>
          !line.trim().startsWith("{") && // Remove directives like {title: ...}
          !line.trim().startsWith("#") && // Remove comments
          line.trim().length > 0, // Remove empty lines
      )
      .map((line) =>
        // Remove chord annotations like [Am] or [C7]
        line.replace(/\[([^\]]+)\]/g, "").trim(),
      )
      .filter((line) => line.length > 0)
      .join("\n");
  }

  /**
   * Generate image prompt from lyrics using OpenAI
   */
  async generatePrompt(lyrics: string): Promise<string> {
    if (lyrics.length < 100) {
      throw new Error("Lyrics too short for meaningful prompt generation");
    }

    const openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
      organization: this.config.openaiOrgId,
      project: this.config.openaiProjectId,
    });

    const response = await openai.chat.completions.create({
      model: this.config.summaryModel,
      messages: [
        { role: "system", content: PROMPTS[this.config.promptVersion] },
        { role: "user", content: lyrics },
      ],
    });

    const prompt = response.choices?.[0]?.message?.content;
    if (!prompt) throw new Error("Failed to generate prompt from OpenAI");

    return prompt;
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const providerType = MODEL_PROVIDERS[this.config.imageModel];
    const provider = this.providers[providerType];

    if (!provider) {
      throw new Error(`No provider registered for type: ${providerType}`);
    }

    return provider.generate(prompt, this.config.imageModel, this.config);
  }

  async createThumbnail(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    // Implement standard thumbnail resizing logic if needed
    return imageBuffer;
  }

  async generateFromLyrics(lyrics: string): Promise<GenerationResult> {
    const prompt = await this.generatePrompt(lyrics);
    const imageBuffer = await this.generateImage(prompt);
    const thumbnailBuffer = await this.createThumbnail(imageBuffer);
    return { prompt, imageBuffer, thumbnailBuffer };
  }

  async generateFromChordPro(
    chordproContent: string,
  ): Promise<GenerationResult> {
    const lyrics = ImageGenerator.extractLyricsFromChordPro(chordproContent);
    return this.generateFromLyrics(lyrics);
  }

  async generateFromChordProUrl(
    chordproUrl: string,
  ): Promise<GenerationResult> {
    const response = await fetch(chordproUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ChordPro: ${response.status}`);
    }
    const chordproContent = await response.text();
    return this.generateFromChordPro(chordproContent);
  }
}
