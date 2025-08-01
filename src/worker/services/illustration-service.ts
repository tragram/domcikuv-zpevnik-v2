import { and, eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  illustrationPrompt,
  IllustrationPromptDB,
  song,
  songIllustration,
  SongIllustrationDB,
} from "src/lib/db/schema";
import { findSong, SongWithCurrentVersion } from "./song-service";
import { Context } from "hono";
import { SongData } from "~/types/songData";
import { z } from "zod";
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

export const illustrationCreateSchema = z.object({
  songId: z.string(),
  summaryPromptId: z.string().optional(),
  imageModel: z.string(),
  setAsActive: z.string().transform((val) => val === "true"), // FormData sends as string
  imageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
});

export const illustrationGenerateSchema = z.object({
  songId: z.string(),
  setAsActive: z.boolean().default(false),
  imageModel: z.enum(IMAGE_MODELS_API),
  promptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
  summaryModel: z.enum(SUMMARY_MODELS_API),
});

export const illustrationModifySchema = z.object({
  imageModel: z.string().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
  setAsActive: z.boolean().optional(),
});

export const illustrationPromptCreateSchema = z.object({
  songId: z.string(),
  summaryPromptVersion: z.string(),
  summaryModel: z.string(),
  text: z.string(),
});

export type IllustrationCreateSchema = z.infer<typeof illustrationCreateSchema>;
export type IllustrationGenerateSchema = z.infer<
  typeof illustrationGenerateSchema
>;
export type IllustrationModifySchema = z.infer<typeof illustrationModifySchema>;
export type adminIllustrationResponse = {
  song: SongWithCurrentVersion;
  illustration: SongIllustrationDB;
  prompt: IllustrationPromptDB;
};
export type IllustrationPromptCreateSchema = z.infer<
  typeof illustrationPromptCreateSchema
>;

const commonR2Key2Folder = (commonR2Key: string, thumbnail: boolean) => {
  return `songs/${
    thumbnail ? "illustration_thumbnails" : "illustrations"
  }/${commonR2Key}`;
};

export const fakeDeleteR2 = async (
  R2_BUCKET: R2Bucket,
  commonR2Key: string
) => {
  const thumbnails = [false, true];
  const results = { imageURL: "", thumbnailURL: "null" };
  for (const thumb of thumbnails) {
    const folder = commonR2Key2Folder(commonR2Key, thumb);
    const file = await R2_BUCKET.get(folder);
    await R2_BUCKET.delete(folder);
    if (!file) {
      throw Error("Failed to retrieve R2 file when deleting!");
    }
    const deletedFolder = "deleted/" + folder;
    if (thumb) {
      results.thumbnailURL = deletedFolder;
    } else {
      results.imageURL = deletedFolder;
    }
    await R2_BUCKET.put(deletedFolder, file.body);
  }
  return results;
};

/**
 * Helper function to upload image buffers to storage and return URLs
 */
export async function uploadImageBuffer(
  imageBuffer: ArrayBuffer,
  songData: SongWithCurrentVersion,
  filename: string,
  env: Env,
  thumbnail: boolean = false
) {
  const commonR2Key = `${SongData.baseId(
    songData.artist,
    songData.title
  )}/${filename}`;
  const imageKey = commonR2Key2Folder(commonR2Key, thumbnail);
  await env.R2_BUCKET.put(imageKey, imageBuffer);
  const imageURL = `${env.CLOUDFLARE_R2_URL}/${imageKey}`;
  return { imageURL, commonR2Key };
}

export async function sameParametersExist(
  db: DrizzleD1Database,
  songId: string,
  summaryPromptId: string,
  imageModel: string
) {
  const result = db
    .select()
    .from(songIllustration)
    .where(
      and(
        eq(songIllustration.songId, songId),
        eq(songIllustration.promptId, summaryPromptId),
        eq(songIllustration.imageModel, imageModel),
        eq(songIllustration.deleted, false)
      )
    )
    .limit(1);
  return (await result).length > 0;
}

/**
 * Helper function to set an illustration as the current active one for a song
 */
export async function setCurrentIllustration(
  db: DrizzleD1Database,
  songId: string,
  illustrationId: string
) {
  await db
    .update(song)
    .set({
      currentIllustrationId: illustrationId,
      updatedAt: new Date(),
    })
    .where(eq(song.id, songId));
}

/**
 * Helper function to clear current illustration for a song
 */
export async function clearCurrentIllustration(
  db: DrizzleD1Database,
  songId: string
) {
  await db
    .update(song)
    .set({
      currentIllustrationId: null,
      updatedAt: new Date(),
    })
    .where(eq(song.id, songId));
}

/**
 * Helper function to find or create a prompt
 */
export async function findOrCreatePrompt(
  db: DrizzleD1Database,
  c: Context,
  songId: string,
  promptVersion: string,
  promptModel: string,
  generator: ImageGenerator,
  songData?: SongWithCurrentVersion
): Promise<IllustrationPromptDB> {
  // Check if prompt already exists
  const existingPrompt = await db
    .select()
    .from(illustrationPrompt)
    .where(
      and(
        eq(illustrationPrompt.id, songId),
        eq(illustrationPrompt.summaryPromptVersion, promptVersion),
        eq(illustrationPrompt.summaryModel, promptModel)
      )
    )
    .limit(1);

  if (existingPrompt.length > 0) {
    return existingPrompt[0];
  }

  // Need to generate new prompt
  let song: SongWithCurrentVersion;
  if (!songData) {
    song = (await findSong(db, songId)) as SongWithCurrentVersion;
  } else {
    song = songData;
  }

  const promptText = await generator.generatePrompt(
    ImageGenerator.extractLyricsFromChordPro(song.chordpro)
  );
  console.log("Prompt Text:", promptText);
  // Create new prompt record
  const newPrompt = await db
    .insert(illustrationPrompt)
    .values({
      id: `${songId}_${promptVersion}_${promptModel}_${Date.now()}`,
      songId,
      summaryPromptVersion: promptVersion,
      summaryModel: promptModel,
      text: promptText,
    })
    .returning();

  return newPrompt[0];
}

/**
 * Helper function to create or find a manual prompt
 */
export async function createOrFindManualPrompt(
  db: DrizzleD1Database,
  songId: string,
  providedPromptId?: string
): Promise<IllustrationPromptDB> {
  // If a specific prompt ID is provided, try to find it
  if (providedPromptId && providedPromptId.trim()) {
    const existingPrompt = await db
      .select()
      .from(illustrationPrompt)
      .where(eq(illustrationPrompt.id, providedPromptId.trim()))
      .limit(1);

    if (existingPrompt.length > 0) {
      return existingPrompt[0];
    }

    // If the provided prompt ID doesn't exist, throw an error
    throw new Error(`Prompt with ID "${providedPromptId}" not found`);
  }

  // Create a new manual prompt
  const promptId = `manual_${songId}_${Date.now()}`;
  const promptData = {
    id: promptId,
    songId: songId,
    summaryPromptVersion: "manual",
    summaryModel: "manual",
    text: "Manual upload - no generated prompt",
  };

  const newPrompt = await db
    .insert(illustrationPrompt)
    .values(promptData)
    .returning();

  return newPrompt[0];
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

    console.log(prompt);

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

    console.log(typeof imageBlob, imageBlob);

    return await imageBlob.arrayBuffer();
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
