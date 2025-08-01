import { InferenceClient } from "@huggingface/inference";

export const SUMMARY_PROMPT_VERSIONS = ["v1", "v2"] as const;
export const SUMMARY_MODELS_API = ["gpt-4o", "gpt-4o-mini"] as const;
export const IMAGE_MODELS_API = ["FLUX.1-dev"] as const;
export type SummaryPromptVersion = (typeof SUMMARY_PROMPT_VERSIONS)[number];
export type AvailableSummaryModel = (typeof SUMMARY_MODELS_API)[number];
export type AvailableImageModel = (typeof IMAGE_MODELS_API)[number];

const PROMPTS: Record<SummaryPromptVersion, string> = {
  v1: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short",
  v2: "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short but also to capture a concrete scene/idea from the song.",
} as const;

const models2HF: Record<AvailableImageModel, string> = {
  "FLUX.1-dev": "black-forest-labs/FLUX.1-dev",
};

export interface GenerationConfig {
  promptVersion: SummaryPromptVersion;
  summaryModel: AvailableSummaryModel;
  imageModel: AvailableImageModel;
  openaiApiKey: string;
  huggingFaceToken: string;
  openaiOrgId?: string;
  openaiProjectId?: string;
}

export interface GenerationResult {
  prompt: string;
  imageBuffer: ArrayBuffer;
  thumbnailBuffer: ArrayBuffer;
}

/**
 * Core Image Generation Class - Platform Agnostic
 * Can be used in both frontend and backend environments
 */
export class ImageGenerator {
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
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
          line.trim().length > 0 // Remove empty lines
      )
      .map((line) =>
        // Remove chord annotations like [Am] or [C7]
        line.replace(/\[([^\]]+)\]/g, "").trim()
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
          {
            role: "system",
            content: PROMPTS[this.config.promptVersion],
          },
          {
            role: "user",
            content: lyrics,
          },
        ],
        temperature: 0.7,
        top_p: 0.8,
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

    if (!prompt) {
      throw new Error("Failed to generate prompt from OpenAI");
    }

    return prompt;
  }

  /**
   * Generate image from prompt using Hugging Face
   */
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const client = new InferenceClient(this.config.huggingFaceToken);

    const imageBlob = await client.textToImage({
      model: models2HF[this.config.imageModel],
      inputs: prompt,
      provider: "hf-inference",
      parameters: {
        height: 512,
        width: 512,
      },
    });

    // TS thinks it's a string even though the docs say it's a Blob, so double cast it to get rid of an error
    return await (imageBlob as unknown as Blob).arrayBuffer();
  }

  /**
   * Create thumbnail from image buffer
   * Note: This is a simple implementation. In production, you might want
   * to use Canvas API (frontend) or image processing service (backend)
   */
  async createThumbnail(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    // For now, return the original image
    // You can implement actual resizing logic here based on your platform
    return imageBuffer;
  }

  /**
   * Generate complete illustration from lyrics
   */
  async generateFromLyrics(lyrics: string): Promise<GenerationResult> {
    const prompt = await this.generatePrompt(lyrics);
    const imageBuffer = await this.generateImage(prompt);
    const thumbnailBuffer = await this.createThumbnail(imageBuffer);

    return {
      prompt,
      imageBuffer,
      thumbnailBuffer,
    };
  }

  /**
   * Generate complete illustration from ChordPro content
   */
  async generateFromChordPro(
    chordproContent: string
  ): Promise<GenerationResult> {
    const lyrics = ImageGenerator.extractLyricsFromChordPro(chordproContent);
    return this.generateFromLyrics(lyrics);
  }

  /**
   * Generate complete illustration from ChordPro URL
   */
  async generateFromChordProUrl(
    chordproUrl: string
  ): Promise<GenerationResult> {
    const response = await fetch(chordproUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ChordPro: ${response.status}`);
    }

    const chordproContent = await response.text();
    return this.generateFromChordPro(chordproContent);
  }
}
