import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { generateAndSavePrompt } from "src/worker/helpers/illustration-helpers";
import {
  GenerationConfig,
  ImageGenerator,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "src/worker/helpers/image-generator";
import z from "zod/v4";
import { defaultPromptId } from "~/types/songData";
import {
  illustrationPrompt,
  IllustrationPromptDB,
  songIllustration,
} from "../../../lib/db/schema";
import {
  errorJSend,
  failJSend,
  itemNotFoundFail,
  songNotFoundFail,
  successJSend,
} from "../responses";
import { buildApp } from "../utils";
import {
  getSongBase,
  getSongPopulated,
  PopulatedSongDB,
} from "src/worker/helpers/song-helpers";

const illustrationPromptCreateSchema = createInsertSchema(
  illustrationPrompt,
).omit({ id: true });
const promptModifySchema = z.object({
  text: z.string().min(1, "Prompt text cannot be empty"),
});
const promptGenerateSchema = z.object({
  songId: z.string(),
  summaryModel: z.enum(SUMMARY_MODELS_API),
  summaryPromptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
});
export type PromptModifySchema = z.infer<typeof promptModifySchema>;
export type PromptGenerateSchema = z.infer<typeof promptGenerateSchema>;

export const illustrationPromptRoutes = buildApp()
  .get("/", async (c) => {
    return successJSend(
      c,
      (await c.var.db
        .select()
        .from(illustrationPrompt)) as IllustrationPromptDB[],
    );
  })
  .put("/:id", zValidator("json", promptModifySchema), async (c) => {
    const promptId = c.req.param("id");
    const updateData = c.req.valid("json");
    const db = c.var.db;

    const existingPrompt = await db
      .select({ id: illustrationPrompt.id })
      .from(illustrationPrompt)
      .where(eq(illustrationPrompt.id, promptId))
      .get();

    if (!existingPrompt) return itemNotFoundFail(c, "prompt");

    const updatedPrompt = await db
      .update(illustrationPrompt)
      .set({ text: updateData.text, updatedAt: new Date() })
      .where(eq(illustrationPrompt.id, promptId))
      .returning();

    return successJSend(c, updatedPrompt[0] as IllustrationPromptDB);
  })
  .post(
    "/create",
    zValidator("json", illustrationPromptCreateSchema),
    async (c) => {
      const promptData = c.req.valid("json");
      const db = c.var.db;

      try {
        await getSongBase(db, promptData.songId);
      } catch {
        return songNotFoundFail(c);
      }

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
        .get();

      if (existingPrompt) return errorJSend(c, "Prompt already exists", 409);

      const newPrompt = await db
        .insert(illustrationPrompt)
        .values({ id: newId, ...promptData })
        .returning();
      return successJSend(c, newPrompt[0] as IllustrationPromptDB, 201);
    },
  )
  .post("/generate", zValidator("json", promptGenerateSchema), async (c) => {
    const { songId, summaryModel, summaryPromptVersion } = c.req.valid("json");
    const db = c.var.db;

    let song: PopulatedSongDB;
    try {
      song = await getSongPopulated(db, songId);
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
      .get();

    if (existingPrompt) return errorJSend(c, "Prompt already exists", 409);
    if (!c.env.OPENAI_API_KEY)
      return errorJSend(c, "Missing API key!", 500, "MISSING_API_KEYS");

    const generationConfig: GenerationConfig = {
      promptVersion: summaryPromptVersion,
      summaryModel,
      imageModel: "gpt-image-1", // Dummy value, we are only generating text here
      openaiApiKey: c.env.OPENAI_API_KEY,
      openaiOrgId: c.env.OPENAI_ORGANIZATION_ID,
      openaiProjectId: c.env.OPENAI_PROJECT_ID,
    };

    const newPrompt = await generateAndSavePrompt(
      db,
      songId,
      summaryPromptVersion,
      summaryModel,
      new ImageGenerator(generationConfig),
      song,
    );
    return successJSend(c, newPrompt as IllustrationPromptDB, 201);
  })
  .delete("/:id", async (c) => {
    const promptId = c.req.param("id");
    const db = c.var.db;

    if (!promptId || promptId.length < 10)
      return failJSend(c, "Invalid prompt ID", 400);

    const dependentIllustrations = await db
      .select({ id: songIllustration.id })
      .from(songIllustration)
      .where(eq(songIllustration.promptId, promptId))
      .get();
    if (dependentIllustrations)
      return failJSend(
        c,
        "Cannot delete that is referenced by illustrations",
        400,
        "PROMPT_IN_USE",
      );

    const existingPrompt = await db
      .select({ id: illustrationPrompt.id })
      .from(illustrationPrompt)
      .where(eq(illustrationPrompt.id, promptId))
      .get();
    if (!existingPrompt) return itemNotFoundFail(c, "prompt");

    await db
      .delete(illustrationPrompt)
      .where(eq(illustrationPrompt.id, promptId));
    return successJSend(c, null);
  });
