import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import z from "zod/v4";
import {
  illustrationPrompt,
  song,
  songIllustration,
  SongIllustrationDB,
} from "../../../lib/db/schema";
import { buildApp } from "../utils";
import {
  createOrFindManualPrompt,
  findOrCreatePrompt,
  setCurrentIllustration,
  clearCurrentIllustration,
  uploadImageBuffer,
  sameParametersExist,
  moveSongToTrash,
  createManualPrompt,
  processAndUploadImages,
} from "../../helpers/illustration-helpers";
import { findSong, SongWithCurrentVersion } from "../../helpers/song-helpers";
import {
  errorFail,
  errorJSend,
  failJSend,
  itemNotFoundFail,
  songNotFoundFail,
  successJSend,
} from "../responses";
import {
  GenerationConfig,
  IMAGE_MODELS_API,
  ImageGenerator,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "../../helpers/image-generator";
import { defaultIllustrationId, defaultPromptId } from "~/types/songData";

const illustrationCreateSchema = z.object({
  songId: z.string(),
  imageModel: z.string(),
  setAsActive: z.string().transform((val) => val === "true"),
  imageFile: z.any().optional(),

  // Prompt Fields
  promptId: z.string().optional(),
  promptText: z.string().optional(),
  summaryModel: z.string().optional(),
  summaryPromptVersion: z.string().optional(),
});

const illustrationGenerateSchema = z.object({
  songId: z.string(),
  setAsActive: z.boolean().default(false),
  imageModel: z.enum(IMAGE_MODELS_API),
  promptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
  summaryModel: z.enum(SUMMARY_MODELS_API),
});
const illustrationModifySchema = z.object({
  imageModel: z.string().optional(),
  setAsActive: z.string().transform((val) => val === "true"),
});
export const CFImagesThumbnailURL = (imageURL: string) => {
  return "/cdn-cgi/image/width=128/" + imageURL;
};

const generateIllustrationHandler = async (c) => {
  try {
    const illustrationData = c.req.valid("json");
    const db = drizzle(c.env.DB);
    let illustrationSong;
    try {
      illustrationSong = (await findSong(
        db,
        illustrationData.songId,
      )) as SongWithCurrentVersion;
    } catch {
      return songNotFoundFail(c);
    }

    if (!c.env.OPENAI_API_KEY || !c.env.HUGGING_FACE_TOKEN) {
      console.error("Missing required API keys for image generation!");
      return errorJSend(
        c,
        "Missing required API keys for image generation!",
        500,
        "MISSING_API_KEYS",
      );
    }

    const generationConfig: GenerationConfig = {
      promptVersion: illustrationData.promptVersion,
      summaryModel: illustrationData.summaryModel,
      imageModel: illustrationData.imageModel,
      openaiApiKey: c.env.OPENAI_API_KEY,
      googleApiKey: c.env.GOOGLE_API_KEY,
      huggingFaceToken: c.env.HUGGING_FACE_TOKEN,
      openaiOrgId: c.env.OPENAI_ORGANIZATION_ID,
      openaiProjectId: c.env.OPENAI_PROJECT_ID,
    };

    const generator = new ImageGenerator(generationConfig);

    const prompt = await findOrCreatePrompt(
      db,
      c,
      illustrationData.songId,
      illustrationData.promptVersion,
      illustrationData.summaryModel,
      generator,
      illustrationSong,
    );

    if (
      await sameParametersExist(
        db,
        illustrationData.songId,
        prompt.id,
        illustrationData.imageModel,
      )
    ) {
      return failJSend(
        c,
        "Illustration with the same parameters already exists.",
        400,
        "DUPLICATE_ILLUSTRATION",
      );
    }

    const imageBuffer = await generator.generateImage(prompt.text);
    const promptId = defaultPromptId(
      illustrationData.songId,
      illustrationData.summaryModel,
      illustrationData.promptVersion,
    );
    const imageId = defaultIllustrationId(
      promptId,
      illustrationData.imageModel,
    );
    const imageURL = await uploadImageBuffer(
      imageBuffer,
      illustrationSong.id,
      promptId,
      illustrationData.imageModel,
      c.env,
    );

    const insertData = {
      id: imageId,
      songId: illustrationData.songId,
      imageModel: illustrationData.imageModel,
      imageURL: imageURL,
      thumbnailURL: CFImagesThumbnailURL(imageURL),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
      promptId: prompt.id,
    };

    const newIllustration = await db
      .insert(songIllustration)
      .values(insertData)
      .returning();

    if (!newIllustration[0]) {
      throw new Error("Failed to insert illustration");
    }

    if (illustrationData.setAsActive) {
      await setCurrentIllustration(
        db,
        illustrationData.songId,
        newIllustration[0].id,
      );
    }

    return successJSend(
      c,
      {
        song: illustrationSong,
        illustration: newIllustration[0] as SongIllustrationDB,
        prompt,
      },
      201,
    );
  } catch (error) {
    console.error("Error generating illustration:", error);
    return errorJSend(c, "Failed to create illustration", 500, "CREATE_ERROR");
  }
};

export const illustrationRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrations: SongIllustrationDB[] = await db
      .select()
      .from(songIllustration);
    return successJSend(c, illustrations);
  })

  .post("/create", async (c) => {
    try {
      const formData = await c.req.formData();
      const formDataObj = Object.fromEntries(formData.entries());
      const validatedData = illustrationCreateSchema.parse(formDataObj);

      const imageFile = formData.get("imageFile") as File | null;
      const db = drizzle(c.env.DB);

      let illustrationSong;
      try {
        illustrationSong = (await findSong(
          db,
          validatedData.songId,
        )) as SongWithCurrentVersion;
      } catch {
        return failJSend(c, "Referenced song not found", 400, "SONG_NOT_FOUND");
      }

      let prompt;
      try {
        if (validatedData.promptId) {
          const existingPrompt = await db
            .select()
            .from(illustrationPrompt)
            .where(eq(illustrationPrompt.id, validatedData.promptId))
            .limit(1);
          if (existingPrompt.length === 0)
            return failJSend(
              c,
              "Selected prompt not found",
              400,
              "INVALID_PROMPT_ID",
            );
          prompt = existingPrompt[0];
        } else if (validatedData.promptText) {
          const model = validatedData.summaryModel || "manual";
          const version = validatedData.summaryPromptVersion || "manual";
          const newId = `${validatedData.songId}_${model}_${version}_${Date.now()}`;
          const newPrompt = await db
            .insert(illustrationPrompt)
            .values({
              id: newId,
              songId: validatedData.songId,
              summaryModel: model,
              summaryPromptVersion: version,
              text: validatedData.promptText,
            })
            .returning();
          prompt = newPrompt[0];
        } else {
          prompt = await createManualPrompt(db, validatedData.songId);
        }
      } catch (error) {
        return error instanceof Error
          ? errorFail(c, error)
          : failJSend(
              c,
              "Failed to resolve prompt",
              400,
              "PROMPT_RESOLUTION_ERROR",
            );
      }

      if (
        await sameParametersExist(
          db,
          validatedData.songId,
          prompt.id,
          validatedData.imageModel,
        )
      ) {
        return failJSend(
          c,
          "Illustration with the same parameters already exists.",
          400,
          "ILLUSTRATION_DUPLICATE",
        );
      }

      const { imageURL, thumbnailURL } = await processAndUploadImages(
        imageFile,
        illustrationSong.id,
        prompt.id,
        validatedData.imageModel,
        c.env,
      );

      if (!imageURL || !thumbnailURL) {
        return failJSend(
          c,
          "An image file must be provided.",
          400,
          "MISSING_IMAGE_DATA",
        );
      }

      const newId = defaultIllustrationId(prompt.id, validatedData.imageModel);
      const newIllustration = await db
        .insert(songIllustration)
        .values({
          id: newId,
          songId: validatedData.songId,
          imageModel: validatedData.imageModel,
          imageURL,
          thumbnailURL,
          createdAt: new Date(),
          updatedAt: new Date(),
          deleted: false,
          promptId: prompt.id,
        })
        .returning();

      if (validatedData.setAsActive)
        await setCurrentIllustration(db, validatedData.songId, newId);

      return successJSend(
        c,
        {
          song: illustrationSong,
          illustration: newIllustration[0] as SongIllustrationDB,
          prompt: prompt,
        },
        201,
      );
    } catch (error) {
      console.error("Error creating manual illustration:", error);
      return errorJSend(
        c,
        "Failed to create manual illustration",
        500,
        "CREATE_ERROR",
      );
    }
  })

  .put("/:id", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);
      const contentType = c.req.header("content-type") || "";

      const existing = await db
        .select()
        .from(songIllustration)
        .where(
          and(
            eq(songIllustration.id, illustrationId),
            eq(songIllustration.deleted, false),
          ),
        )
        .limit(1);
      if (existing.length === 0) return itemNotFoundFail(c, "illustration");
      const current = existing[0];

      let parsedData: any = {};
      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();
        const obj = Object.fromEntries(formData.entries());
        parsedData = illustrationModifySchema.parse(obj);
        parsedData.imageFile = formData.get("imageFile");
      } else {
        parsedData = illustrationModifySchema.parse(await c.req.json());
      }

      const targetModel = parsedData.imageModel || current.imageModel;
      const { imageURL, thumbnailURL } = await processAndUploadImages(
        parsedData.imageFile,
        current.songId,
        current.promptId,
        targetModel,
        c.env,
      );

      const updateData: any = {
        imageModel: targetModel,
        updatedAt: new Date(),
      };

      if (imageURL) {
        updateData.imageURL = imageURL;
        updateData.thumbnailURL = thumbnailURL;
      }

      const updatedIllustration = await db
        .update(songIllustration)
        .set(updateData)
        .where(eq(songIllustration.id, illustrationId))
        .returning();

      if (parsedData.setAsActive) {
        await setCurrentIllustration(db, current.songId, illustrationId);
      } else if (parsedData.setAsActive === false) {
        const currentSong = await db
          .select({ currentIllustrationId: song.currentIllustrationId })
          .from(song)
          .where(eq(song.id, current.songId))
          .limit(1);
        if (currentSong[0]?.currentIllustrationId === illustrationId) {
          await clearCurrentIllustration(db, current.songId);
        }
      }

      const [illustrationSong, prompt] = await Promise.all([
        findSong(db, current.songId),
        db
          .select()
          .from(illustrationPrompt)
          .where(eq(illustrationPrompt.id, current.promptId))
          .limit(1),
      ]);

      return successJSend(c, {
        song: illustrationSong as SongWithCurrentVersion,
        illustration: updatedIllustration[0] as SongIllustrationDB,
        prompt: prompt[0],
      });
    } catch (error) {
      console.error("Error modifying illustration:", error);
      return errorJSend(
        c,
        "Failed to modify illustration",
        500,
        "UPDATE_ERROR",
      );
    }
  })

  .post(
    "/generate",
    zValidator("json", illustrationGenerateSchema),
    generateIllustrationHandler,
  )

  .delete("/:id", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);

      if (!illustrationId || illustrationId.length < 10) {
        return failJSend(
          c,
          "Invalid illustration ID format",
          400,
          "INVALID_ID",
        );
      }

      const existingIllustration = await db
        .select({
          id: songIllustration.id,
          songId: songIllustration.songId,
          imageURL: songIllustration.imageURL,
          promptId: songIllustration.promptId,
          thumbnailURL: songIllustration.thumbnailURL,
          imageModel: songIllustration.imageModel,
        })
        .from(songIllustration)
        .where(
          and(
            eq(songIllustration.id, illustrationId),
            eq(songIllustration.deleted, false),
          ),
        )
        .limit(1);

      if (existingIllustration.length === 0) {
        return failJSend(
          c,
          "Illustration not found",
          404,
          "ILLUSTRATION_NOT_FOUND",
        );
      }

      const songId = existingIllustration[0].songId;

      const currentSong = await db
        .select({ currentIllustrationId: song.currentIllustrationId })
        .from(song)
        .where(eq(song.id, songId))
        .limit(1);

      if (currentSong[0]?.currentIllustrationId === illustrationId) {
        await clearCurrentIllustration(db, songId);
      }

      try {
        await moveSongToTrash(
          c.env.R2_BUCKET,
          songId,
          existingIllustration[0].promptId,
          existingIllustration[0].imageModel,
        );
      } catch (e) {}

      await db
        .update(songIllustration)
        .set({
          deleted: true,
          updatedAt: new Date(),
        })
        .where(eq(songIllustration.id, illustrationId));

      return successJSend(c, { deletedId: illustrationId });
    } catch (error) {
      console.error("Error deleting illustration:", error);
      return errorJSend(
        c,
        "Failed to delete illustration",
        500,
        "DELETE_ERROR",
      );
    }
  })
  .post("/:id/restore", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);

      const restoredIllustration = await db
        .update(songIllustration)
        .set({
          deleted: false,
          updatedAt: new Date(),
        })
        .where(eq(songIllustration.id, illustrationId))
        .returning();

      return successJSend(c, { restoredIllustration });
    } catch (error) {
      console.error("Error restoring illustration:", error);
      return errorJSend(
        c,
        "Failed to restore illustration",
        500,
        "RESTORE_ERROR",
      );
    }
  });

export const trustedGenerateRoute = buildApp().post(
  "/generate",
  zValidator("json", illustrationGenerateSchema),
  generateIllustrationHandler,
);
