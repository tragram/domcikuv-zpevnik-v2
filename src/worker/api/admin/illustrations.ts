import { drizzle } from "drizzle-orm/d1";
import {
  song,
  SongDataDB,
  songIllustration,
  SongIllustrationDB,
  illustrationPrompt,
  IllustrationPromptDB,
} from "../../../lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import z from "zod/v4";
import { findSong } from "./songs";
import { illustrationPromptRoutes } from "./illustration-prompts";

// Updated illustration validation schemas to match new structure
const illustrationCreateSchema = z.object({
  songId: z.string(),
  promptId: z.string(),
  imageModel: z.string(),
  imageURL: z.string(),
  thumbnailURL: z.string(),
  isActive: z.boolean().default(false),
});

const illustrationModifySchema = z.object({
  id: z.string(),
  imageModel: z.string().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type IllustrationModifySchema = z.infer<typeof illustrationModifySchema>;
export type IllustrationCreateSchema = z.infer<typeof illustrationCreateSchema>;
export type adminIllustrationResponse = {
  song: SongDataDB;
  illustration: SongIllustrationDB;
  prompt: IllustrationPromptDB;
};

export const illustrationRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrations = await db.select().from(songIllustration);
    return c.json(
      {
        status: "success",
        data: illustrations,
      },
      201
    );
  })

  .post("/create", zValidator("json", illustrationCreateSchema), async (c) => {
    try {
      const illustrationData = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Verify the song exists
      let illustrationSong;
      try {
        illustrationSong = await findSong(db, illustrationData.songId);
      } catch {
        return c.json(
          {
            status: "fail",
            failData: { songId: "Referenced song not found" },
          },
          400
        );
      }

      // verify the prompt exists
      const existingPrompt = await db
        .select({ id: illustrationPrompt.id })
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, illustrationData.promptId))
        .limit(1);

      if (existingPrompt.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: { promptId: "Referenced prompt not found" },
          },
          400
        );
      }

      // If this illustration is being set as active, deactivate all other illustrations for this song
      if (illustrationData.isActive) {
        await db
          .update(songIllustration)
          .set({ isActive: false })
          .where(eq(songIllustration.songId, illustrationData.songId));
      }

      // Generate unique ID based on the source type
      const newId = `${illustrationData.songId}_${illustrationData.promptId}_${
        illustrationData.imageModel
      }_${Date.now()}`;
      // TODO: onConflict
      const insertData = {
        id: newId,
        songId: illustrationData.songId,
        imageModel: illustrationData.imageModel,
        imageURL: illustrationData.imageURL,
        thumbnailURL: illustrationData.thumbnailURL,
        isActive: illustrationData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
        promptId: illustrationData.promptId,
      };

      const newIllustration = await db
        .insert(songIllustration)
        .values(insertData)
        .returning();

      // Fetch the prompt
      let prompt = null;
      const promptResult = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, illustrationData.promptId))
        .limit(1);
      prompt = promptResult[0] || null;

      return c.json(
        {
          status: "success",
          data: {
            song: illustrationSong,
            illustration: newIllustration[0] as SongIllustrationDB,
            prompt,
          } as adminIllustrationResponse,
        },
        201
      );
    } catch (error) {
      console.error("Error creating illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to create illustration",
          code: "CREATE_ERROR",
        },
        500
      );
    }
  })

  .post("/modify", zValidator("json", illustrationModifySchema), async (c) => {
    try {
      const modifiedIllustration = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Check if illustration exists and get its song ID
      const existingIllustration = await db
        .select({
          id: songIllustration.id,
          songId: songIllustration.songId,
          promptId: songIllustration.promptId,
        })
        .from(songIllustration)
        .where(eq(songIllustration.id, modifiedIllustration.id))
        .limit(1);

      if (existingIllustration.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              illustrationId: "Illustration not found",
              code: "ILLUSTRATION_NOT_FOUND",
            },
          },
          404
        );
      }

      const songId = existingIllustration[0].songId;

      // If this illustration is being set as active, deactivate all other illustrations for this song
      if (modifiedIllustration.isActive === true) {
        await db
          .update(songIllustration)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(songIllustration.songId, songId),
              eq(songIllustration.isActive, true)
            )
          );
      }

      const updatedIllustration = await db
        .update(songIllustration)
        .set({
          ...modifiedIllustration,
          updatedAt: new Date(),
        })
        .where(eq(songIllustration.id, modifiedIllustration.id))
        .returning();

      let illustrationSong;
      try {
        illustrationSong = await findSong(db, songId);
      } catch {
        return c.json(
          {
            status: "fail",
            failData: { "song.id": "Referenced song not found" },
          },
          400
        );
      }

      // Fetch the prompt
      const promptResult = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, existingIllustration[0].promptId))
        .limit(1);
      const prompt = promptResult[0];

      return c.json({
        status: "success",
        data: {
          song: illustrationSong,
          illustration: updatedIllustration[0] as SongIllustrationDB,
          prompt,
        } as adminIllustrationResponse,
      });
    } catch (error) {
      console.error("Error modifying illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to modify illustration",
          code: "UPDATE_ERROR",
        },
        500
      );
    }
  })

  .delete("/:id", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Basic ID validation
      if (!illustrationId || illustrationId.length < 10) {
        return c.json(
          {
            status: "fail",
            failData: {
              illustrationId: "Invalid illustration ID format",
              code: "INVALID_ID",
            },
          },
          400
        );
      }

      // Check if illustration exists
      const existingIllustration = await db
        .select({ id: songIllustration.id })
        .from(songIllustration)
        .where(eq(songIllustration.id, illustrationId))
        .limit(1);

      if (existingIllustration.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              illustrationId: "Illustration not found",
              code: "ILLUSTRATION_NOT_FOUND",
            },
          },
          404
        );
      }

      await db
        .delete(songIllustration)
        .where(eq(songIllustration.id, illustrationId));

      return c.json({
        status: "success",
        data: songIllustration.id,
      });
    } catch (error) {
      console.error("Error deleting illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to delete illustration",
          code: "DELETE_ERROR",
        },
        500
      );
    }
  })
  .route("/prompts", illustrationPromptRoutes);
