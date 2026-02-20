import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createInsertSchema } from "drizzle-zod";
import { illustrationPrompt, songIllustration } from "../../../lib/db/schema";
import { buildApp } from "../utils";
import { findSong } from "../../helpers/song-helpers";
import {
  errorJSend,
  failJSend,
  itemNotFoundFail,
  songNotFoundFail,
  successJSend,
} from "../responses";
import { defaultPromptId } from "~/types/songData";
import z from "zod/v4";
import { GenerationConfig, ImageGenerator, SUMMARY_MODELS_API, SUMMARY_PROMPT_VERSIONS } from "src/worker/helpers/image-generator";
import { generateAndSavePrompt } from "src/worker/helpers/illustration-helpers";

const illustrationPromptCreateSchema = createInsertSchema(
  illustrationPrompt,
).omit({
  id: true,
});

const promptModifySchema = z.object({
  text: z.string().min(1, "Prompt text cannot be empty"),
});

const promptGenerateSchema = z.object({
  songId: z.string(),
  summaryModel: z.enum(SUMMARY_MODELS_API),
  summaryPromptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
});

export const illustrationPromptRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrationPrompts = await db.select().from(illustrationPrompt);
    return successJSend(c, illustrationPrompts);
  })
  .put("/:id", zValidator("json", promptModifySchema), async (c) => {
    try {
      const promptId = c.req.param("id");
      const updateData = c.req.valid("json");
      const db = drizzle(c.env.DB);

      const existingPrompt = await db
        .select({ id: illustrationPrompt.id })
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, promptId))
        .limit(1);

      if (existingPrompt.length === 0) {
        return itemNotFoundFail(c, "prompt");
      }

      const updatedPrompt = await db
        .update(illustrationPrompt)
        .set({
          text: updateData.text,
          updatedAt: new Date(),
        })
        .where(eq(illustrationPrompt.id, promptId))
        .returning();

      return successJSend(c, updatedPrompt[0]);
    } catch (error) {
      console.error("Error updating illustration prompt:", error);
      return errorJSend(
        c,
        "Failed to update illustration prompt",
        500,
        "UPDATE_ERROR",
      );
    }
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
          return songNotFoundFail(c);
        }

        // Generate unique ID for the prompt
        const newId = defaultPromptId(
          promptData.songId,
          promptData.summaryModel,
          promptData.summaryPromptVersion,
        );

        // assume that a combination song-model-prompt fully defines the image prompt
        const existingPrompt = await db
          .select()
          .from(illustrationPrompt)
          .where(eq(illustrationPrompt.id, newId))
          .limit(1);
        if (existingPrompt.length !== 0) {
          return errorJSend(
            c,
            "Prompt with the given combination songId-summaryModel-summaryPromptVersion already exists",
            409,
          );
        }

        const newPrompt = await db
          .insert(illustrationPrompt)
          .values({
            id: newId,
            ...promptData,
          })
          .returning();

        return successJSend(c, newPrompt[0], 201);
      } catch (error) {
        console.error("Error creating illustration prompt:", error);
        return errorJSend(
          c,
          "Failed to create illustration prompt",
          500,
          "CREATE_ERROR",
        );
      }
    },
  )
  .post("/generate", zValidator("json", promptGenerateSchema), async (c) => {
    try {
      const { songId, summaryModel, summaryPromptVersion } =
        c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Verify the song exists
      let song;
      try {
        song = await findSong(db, songId);
      } catch {
        return songNotFoundFail(c);
      }

      // Check if prompt already exists to prevent duplicate generation costs
      const expectedId = defaultPromptId(
        songId,
        summaryModel,
        summaryPromptVersion,
      );
      const existingPrompt = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, expectedId))
        .limit(1);

      if (existingPrompt.length !== 0) {
        return errorJSend(
          c,
          "Prompt with the given combination already exists",
          409,
        );
      }

      // Validate API keys
      if (!c.env.OPENAI_API_KEY) {
        return errorJSend(
          c,
          "Missing OpenAI API key!",
          500,
          "MISSING_API_KEYS",
        );
      }

      const generationConfig: GenerationConfig = {
        promptVersion: summaryPromptVersion,
        summaryModel: summaryModel,
        imageModel: "gpt-image-1", // Dummy value, we are only generating text here
        openaiApiKey: c.env.OPENAI_API_KEY,
        huggingFaceToken: c.env.HUGGING_FACE_TOKEN || "", // Not needed for text, but required by type
        openaiOrgId: c.env.OPENAI_ORGANIZATION_ID,
        openaiProjectId: c.env.OPENAI_PROJECT_ID,
      };

      const generator = new ImageGenerator(generationConfig);

      // Use our DRY helper
      const newPrompt = await generateAndSavePrompt(
        db,
        songId,
        summaryPromptVersion,
        summaryModel,
        generator,
        song,
      );

      return successJSend(c, newPrompt, 201);
    } catch (error) {
      console.error("Error generating illustration prompt:", error);
      return errorJSend(
        c,
        "Failed to generate illustration prompt",
        500,
        "GENERATE_ERROR",
      );
    }
  })

  .delete("/:id", async (c) => {
    try {
      const promptId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Basic ID validation
      if (!promptId || promptId.length < 10) {
        return failJSend(c, "Invalid prompt ID format", 400, "INVALID_ID");
      }

      // Check if there are any illustrations using this prompt
      const dependentIllustrations = await db
        .select({ id: songIllustration.id })
        .from(songIllustration)
        .where(eq(songIllustration.promptId, promptId))
        .limit(1);

      if (dependentIllustrations.length > 0) {
        return failJSend(
          c,
          "Cannot delete prompt that is referenced by illustrations",
          400,
          "PROMPT_IN_USE",
        );
      }

      // Check if prompt exists
      const existingPrompt = await db
        .select({ id: illustrationPrompt.id })
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, promptId))
        .limit(1);

      if (existingPrompt.length === 0) {
        return itemNotFoundFail(c, "prompt");
      }

      await db
        .delete(illustrationPrompt)
        .where(eq(illustrationPrompt.id, promptId));

      return successJSend(c, null);
    } catch (error) {
      console.error("Error deleting illustration prompt:", error);
      return errorJSend(
        c,
        "Failed to delete illustration prompt",
        500,
        "DELETE_ERROR",
      );
    }
  });
