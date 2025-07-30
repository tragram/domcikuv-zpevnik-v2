import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { createInsertSchema } from "drizzle-zod";
import { Context } from "hono";
import z from "zod/v4";
import {
  illustrationPrompt,
  IllustrationPromptDB,
  SongDataDB,
  songIllustration
} from "../../../lib/db/schema";
import { buildApp } from "../utils";
import { ImageGenerator } from "./image-generator";
import { findSong } from "./songs";

const illustrationPromptCreateSchema = createInsertSchema(
  illustrationPrompt
).omit({
  id: true,
});

export type IllustrationPromptCreateSchema = z.infer<
  typeof illustrationPromptCreateSchema
>;

export type IllustrationPromptRecords = Record<string, IllustrationPromptDB>;

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
  songData?: SongDataDB
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
  let song = songData;
  if (!song) {
    song = await findSong(db, songId);
  }

  let chordproURL = song.chordproURL;
  if (song.chordproURL.match(/^\/*songs/)) {
    // static file
    chordproURL =
      (import.meta.env.DEV ? c.env.VITE_BASE_URL : c.env.PROD_BASE_URL) +
      chordproURL;
  }
  const chordproContentResponse = await fetch(chordproURL);
  if (!chordproContentResponse.ok) {
    throw Error("Failed to fetch ChordPro content, cannot generate prompt.");
  }
  const chordproContent = await chordproContentResponse.text();
  console.log("ChProContent:", chordproContent);

  const promptText = await generator.generatePrompt(
    ImageGenerator.extractLyricsFromChordPro(chordproContent)
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

export const illustrationPromptRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrationPrompts = await db.select().from(illustrationPrompt);
    return c.json(
      {
        status: "success",
        data: illustrationPrompts,
      },
      201
    );
  })

  .post(
    "/create",
    zValidator("json", illustrationPromptCreateSchema),
    async (c) => {
      try {
        const promptData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify the song exists
        try {
          await findSong(db, promptData.songId);
        } catch {
          return c.json(
            {
              status: "fail",
              failData: { songId: "Referenced song not found" },
            },
            400
          );
        }

        // Generate unique ID for the prompt
        const newId = `${promptData.songId}_${
          promptData.summaryPromptVersion
        }_${promptData.summaryModel}_${Date.now()}`;

        const newPrompt = await db
          .insert(illustrationPrompt)
          .values({
            id: newId,
            ...promptData,
          })
          .returning();

        return c.json(
          {
            status: "success",
            data: newPrompt[0],
          },
          201
        );
      } catch (error) {
        console.error("Error creating illustration prompt:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to create illustration prompt",
            code: "CREATE_ERROR",
          },
          500
        );
      }
    }
  )

  .delete("/:id", async (c) => {
    try {
      const promptId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Basic ID validation
      if (!promptId || promptId.length < 10) {
        return c.json(
          {
            status: "fail",
            failData: {
              promptId: "Invalid prompt ID format",
              code: "INVALID_ID",
            },
          },
          400
        );
      }

      // Check if there are any illustrations using this prompt
      const dependentIllustrations = await db
        .select({ id: songIllustration.id })
        .from(songIllustration)
        .where(eq(songIllustration.promptId, promptId))
        .limit(1);

      if (dependentIllustrations.length > 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              promptId:
                "Cannot delete prompt that is referenced by illustrations",
              code: "PROMPT_IN_USE",
            },
          },
          400
        );
      }

      // Check if prompt exists
      const existingPrompt = await db
        .select({ id: illustrationPrompt.id })
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, promptId))
        .limit(1);

      if (existingPrompt.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              promptId: "Prompt not found",
              code: "PROMPT_NOT_FOUND",
            },
          },
          404
        );
      }

      await db
        .delete(illustrationPrompt)
        .where(eq(illustrationPrompt.id, promptId));

      return c.json({
        status: "success",
        data: null,
      });
    } catch (error) {
      console.error("Error deleting illustration prompt:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to delete illustration prompt",
          code: "DELETE_ERROR",
        },
        500
      );
    }
  });
