import { InferenceClient } from "@huggingface/inference";

// the first element of each array is used as default by the frontend
export const SUMMARY_PROMPT_VERSIONS = ["v2", "v1"] as const;
export const SUMMARY_MODELS_API = ["gpt-5-mini", "gpt-5.2"] as const;

// Added FLUX.2 to the list of available models
export const IMAGE_MODELS_API = [
  "FLUX.1-dev",
  "FLUX.1-schnell",
  // "FLUX.2-dev", 
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
] as const;

export type SummaryPromptVersion = (typeof SUMMARY_PROMPT_VERSIONS)[number];
export type AvailableSummaryModel = (typeof SUMMARY_MODELS_API)[number];
export type AvailableImageModel = (typeof IMAGE_MODELS_API)[number];

const PROMPTS: Record<SummaryPromptVersion, string> = {
  v1: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short",
  v2: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short but also to capture a concrete scene/idea from the song.",
} as const;

// Define available provider types
export type ImageProviderType = "openai" | "huggingface";

// Easily map models to their respective providers
export const MODEL_PROVIDERS: Record<AvailableImageModel, ImageProviderType> = {
  "FLUX.1-dev": "huggingface",
  "FLUX.1-schnell": "huggingface",
  // "FLUX.2-dev": "replicate",
  "gpt-image-1.5": "openai",
  "gpt-image-1": "openai",
  "gpt-image-1-mini": "openai",
};

// Map generic model names to provider-specific endpoints/tags
const PROVIDER_MODEL_NAMES: Partial<Record<AvailableImageModel, string>> = {
  "FLUX.1-dev": "black-forest-labs/FLUX.1-dev",
  "FLUX.1-schnell": "black-forest-labs/FLUX.1-schnell",
  // "FLUX.2-dev": "black-forest-labs/flux-2",
};

export interface GenerationConfig {
  promptVersion: SummaryPromptVersion;
  summaryModel: AvailableSummaryModel;
  imageModel: AvailableImageModel;
  openaiApiKey: string;
  huggingFaceToken?: string;
  replicateApiToken?: string; // Added token for Replicate
  openaiOrgId?: string;
  openaiProjectId?: string;
}

export interface GenerationResult {
  prompt: string;
  imageBuffer: ArrayBuffer;
  thumbnailBuffer: ArrayBuffer;
}

// --- Image Provider Interfaces & Implementations ---

interface ImageProvider {
  generate(prompt: string, model: string, config: GenerationConfig): Promise<ArrayBuffer>;
}

class OpenAIImageProvider implements ImageProvider {
  async generate(prompt: string, model: string, config: GenerationConfig): Promise<ArrayBuffer> {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
        ...(config.openaiOrgId && { "OpenAI-Organization": config.openaiOrgId }),
        ...(config.openaiProjectId && { "OpenAI-Project": config.openaiProjectId }),
      },
      body: JSON.stringify({
        model: model,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI image generation error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { data: { b64_json: string }[] };
    const base64 = data.data[0].b64_json;
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  }
}

class HuggingFaceImageProvider implements ImageProvider {
  async generate(prompt: string, model: string, config: GenerationConfig): Promise<ArrayBuffer> {
    if (!config.huggingFaceToken) throw new Error("Hugging Face token is required");
    
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

export class ImageGenerator {
  private config: GenerationConfig;
  private providers: Record<ImageProviderType, ImageProvider>;

  constructor(config: GenerationConfig) {
    this.config = config;
    // Register your providers here
    this.providers = {
      openai: new OpenAIImageProvider(),
      huggingface: new HuggingFaceImageProvider(),
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.openaiApiKey}`,
        "Content-Type": "application/json",
        ...(this.config.openaiOrgId && {
          "OpenAI-Organization": this.config.openaiOrgId,
        }),
        ...(this.config.openaiProjectId && {
          "OpenAI-Project": this.config.openaiProjectId,
        }),
      },
      body: JSON.stringify({
        model: this.config.summaryModel,
        messages: [
          { role: "system", content: PROMPTS[this.config.promptVersion] },
          { role: "user", content: lyrics },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const prompt = data.choices?.[0]?.message?.content;
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