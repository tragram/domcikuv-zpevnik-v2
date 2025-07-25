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

const illustrationPromptCreateSchema = createInsertSchema(
  illustrationPrompt
).omit({
  id: true,
});

export type IllustrationPromptCreateSchema = z.infer<
  typeof illustrationPromptCreateSchema
>;

export type IllustrationPromptRecords = Record<string,IllustrationPromptDB>;

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
        const newId = `${promptData.songId}_${promptData.summaryPromptId}_${
          promptData.summaryModel
        }_${Date.now()}`;

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
