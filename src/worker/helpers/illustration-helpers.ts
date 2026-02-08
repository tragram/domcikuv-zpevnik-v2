import { and, eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  illustrationPrompt,
  IllustrationPromptDB,
  song,
  songIllustration,
  SongIllustrationDB,
} from "src/lib/db/schema";
import { findSong, SongWithCurrentVersion } from "./song-helpers";
import { Context } from "hono";
import { promptFolder } from "~/types/songData";
import { z } from "zod";
import {
  IMAGE_MODELS_API,
  ImageGenerator,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "./image-generator";

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

const imageFolder = (
  songId: string,
  promptId: string,
  imageModel: string,
  thumbnail: boolean
) => {
  return `songs/illustrations/${songId}/${promptFolder(songId, promptId)}/${
    thumbnail ? "thumbnail" : "full"
  }/${imageModel}`;
};

export const moveToTrashR2 = async (R2_BUCKET: R2Bucket, fileName: string) => {
  const trashFilename = "trash/" + fileName;
  const file = await R2_BUCKET.get(fileName);
  if (!file) {
    throw Error("Failed to retrieve R2 file when deleting!");
  }
  await R2_BUCKET.put(trashFilename, file.body);
  await R2_BUCKET.delete(fileName);
  return trashFilename;
};

export const moveSongToTrash = async (
  R2_BUCKET: R2Bucket,
  songId: string,
  promptId: string,
  imageModel: string
) => {
  const thumbnails = [false, true];
  const results = { imageURL: "", thumbnailURL: "" };
  for (const thumb of thumbnails) {
    const imageKey = imageFolder(songId, promptId, imageModel, thumb);
    const trashFilename = await moveToTrashR2(R2_BUCKET, imageKey);
    if (thumb) {
      results.thumbnailURL = trashFilename;
    } else {
      results.imageURL = trashFilename;
    }
  }
  return results;
};

/**
 * Helper function to upload image buffers to storage and return URLs
 */
export async function uploadImageBuffer(
  imageBuffer: ArrayBuffer,
  songId: string,
  promptId: string,
  imageModel: string,
  env: Env,
  thumbnail: boolean = false
) {
  const imageKey = imageFolder(songId, promptId, imageModel, thumbnail);
  await env.R2_BUCKET.put(imageKey, imageBuffer);
  const imageURL = `${env.CLOUDFLARE_R2_URL}/${imageKey}`;
  return imageURL;
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
        eq(illustrationPrompt.songId, songId),
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
  const promptId = `${songId}_manual-${Date.now()}`;
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
