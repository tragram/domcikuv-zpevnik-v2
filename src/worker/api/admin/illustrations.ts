import { and, eq } from "drizzle-orm";
import OpenAI from "openai";
import {
  getSongPopulated,
  PopulatedSongDB,
} from "src/worker/helpers/song-helpers";
import z from "zod";
import { defaultIllustrationId, defaultPromptId } from "src/lib/song-ids";
import {
  illustrationPrompt,
  song,
  songIllustration,
  SongIllustrationDB,
  songVersion,
} from "../../../lib/db/schema";
import {
  clearCurrentIllustration,
  createManualPrompt,
  findOrCreatePrompt,
  moveSongToTrash,
  processAndUploadImages,
  sameParametersExist,
  setCurrentIllustration,
  uploadImageBuffer,
} from "../../helpers/illustration-helpers";
import {
  DEFAULT_ILLUSTRATION_MODELS,
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
  type IllustrationDefaults,
} from "src/lib/contracts/image-generation";
import { ImageGenerator, MODEL_PROVIDERS } from "../../helpers/image-generator";
import {
  AdminIllustrationResponse,
  IllustrationGenerateSchema,
} from "../api-types";
import {
  errorJSend,
  failJSend,
  itemNotFoundFail,
  successJSend,
  zValidatorJSend,
} from "../responses";
import { AppDatabase, buildApp } from "../utils";

export const illustrationCreateSchema = z.object({
  songId: z.string(),
  imageModel: z.string(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true),
  promptId: z.string().optional(),
  promptText: z.string().optional(),
  summaryModel: z.string().optional(),
  summaryPromptVersion: z.string().optional(),
  imageFile: z.any().optional(),
});

export const illustrationGenerateSchema = z.object({
  songId: z.string(),
  versionId: z.string().min(1).optional(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true),
  imageModel: z.enum(IMAGE_MODELS_API),
  // Allow historical settings to identify saved prompts. The generator
  // validates both fields before it creates a new prompt.
  promptVersion: z.string().min(1),
  summaryModel: z.string().min(1),
});

const illustrationDefaultsSchema = z.object({
  summaryModel: z.enum(SUMMARY_MODELS_API),
  imageModel: z.enum(IMAGE_MODELS_API),
});

export const illustrationGenerateRequestSchema = illustrationGenerateSchema
  .partial({ imageModel: true, summaryModel: true })
  .extend({
    promptVersion: z.string().min(1).default(SUMMARY_PROMPT_VERSIONS[0]),
  });

const illustrationDefaultsKey = "illustration-default-models";

async function getIllustrationDefaults(kv: KVNamespace): Promise<IllustrationDefaults> {
  const stored = await kv.get<Partial<Record<keyof IllustrationDefaults, unknown>>>(
    illustrationDefaultsKey,
    "json",
  );
  const summaryModel = illustrationDefaultsSchema.shape.summaryModel.safeParse(
    stored?.summaryModel,
  );
  const imageModel = illustrationDefaultsSchema.shape.imageModel.safeParse(
    stored?.imageModel,
  );
  return {
    summaryModel: summaryModel.data ?? DEFAULT_ILLUSTRATION_MODELS.summaryModel,
    imageModel: imageModel.data ?? DEFAULT_ILLUSTRATION_MODELS.imageModel,
  };
}

async function resolveGenerationModels(
  kv: KVNamespace,
  { summaryModel, imageModel, ...data }: z.output<typeof illustrationGenerateRequestSchema>,
): Promise<IllustrationGenerateSchema> {
  if (summaryModel && imageModel) return { ...data, summaryModel, imageModel };

  const defaults = await getIllustrationDefaults(kv);
  return {
    ...data,
    summaryModel: summaryModel ?? defaults.summaryModel,
    imageModel: imageModel ?? defaults.imageModel,
  };
}

export const illustrationModifySchema = z.object({
  imageModel: z.string().optional(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true)
    .optional(),
  imageFile: z.any().optional(),
});

export const CFImagesThumbnailURL = (imageURL: string) =>
  `/cdn-cgi/image/width=128/${imageURL}`;

export const coreGenerateIllustration = async (
  env: Env,
  db: AppDatabase,
  illustrationData: IllustrationGenerateSchema,
) => {
  let illustrationSong: PopulatedSongDB;
  try {
    illustrationSong = await getSongPopulated(db, illustrationData.songId);
  } catch {
    throw new Error("SONG_NOT_FOUND");
  }

  if (illustrationData.versionId) {
    const version = await db.query.songVersion.findFirst({
      where: and(
        eq(songVersion.id, illustrationData.versionId),
        eq(songVersion.songId, illustrationData.songId),
        eq(songVersion.status, "published"),
      ),
      with: { songImport: true, submission: true },
    });
    if (!version || version.mergedIntoVersionId) throw new Error("SONG_NOT_FOUND");
    illustrationSong.currentVersion = version;
  }

  const imageKeys = {
    openai: env.OPENAI_API_KEY,
    google: env.GOOGLE_API_KEY,
    huggingface: env.HUGGING_FACE_TOKEN,
  };
  if (!imageKeys[MODEL_PROVIDERS[illustrationData.imageModel]]) {
    throw new Error("MISSING_API_KEYS");
  }

  const generator = new ImageGenerator({
    promptVersion: illustrationData.promptVersion,
    summaryModel: illustrationData.summaryModel,
    imageModel: illustrationData.imageModel,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiOrgId: env.OPENAI_ORGANIZATION_ID,
    openaiProjectId: env.OPENAI_PROJECT_ID,
    googleApiKey: env.GOOGLE_API_KEY,
    huggingFaceToken: env.HUGGING_FACE_TOKEN,
  });

  const prompt = await findOrCreatePrompt(
    db,
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
    throw new Error("DUPLICATE_ILLUSTRATION");
  }

  const imageBuffer = await generator.generateImage(prompt.text);

  const imageId = defaultIllustrationId(prompt.id, illustrationData.imageModel);
  const imageURL = await uploadImageBuffer(
    imageBuffer,
    illustrationSong.id,
    prompt.id,
    illustrationData.imageModel,
    env,
  );

  const newIllustration = await db
    .insert(songIllustration)
    .values({
      id: imageId,
      songId: illustrationData.songId,
      imageModel: illustrationData.imageModel,
      imageURL,
      thumbnailURL: CFImagesThumbnailURL(imageURL),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false,
      promptId: prompt.id,
    })
    .returning();

  if (illustrationData.setAsActive) {
    await setCurrentIllustration(
      db,
      illustrationData.songId,
      newIllustration[0].id,
    );
  }

  return {
    song: illustrationSong,
    illustration: newIllustration[0] as SongIllustrationDB,
    prompt,
  } as AdminIllustrationResponse;
};

export const illustrationRoutes = buildApp()
  .get("/", async (c) =>
    successJSend(
      c,
      (await c.var.db.select().from(songIllustration)) as SongIllustrationDB[],
    ),
  )
  .get("/defaults", async (c) =>
    successJSend(c, await getIllustrationDefaults(c.env.KV)),
  )
  .put(
    "/defaults",
    zValidatorJSend("json", illustrationDefaultsSchema),
    async (c) => {
      const defaults = c.req.valid("json");
      await c.env.KV.put(illustrationDefaultsKey, JSON.stringify(defaults));
      return successJSend(c, defaults);
    },
  )
  .post(
    "/create",
    zValidatorJSend("form", illustrationCreateSchema),
    async (c) => {
      const validatedData = c.req.valid("form");
      const imageFile = validatedData.imageFile as File | null;
      const db = c.var.db;

      let illustrationSong: PopulatedSongDB;
      try {
        illustrationSong = await getSongPopulated(db, validatedData.songId);
      } catch {
        return failJSend(c, "Referenced song not found", 400, "SONG_NOT_FOUND");
      }

      let prompt;
      if (validatedData.promptId) {
        prompt = await db
          .select()
          .from(illustrationPrompt)
          .where(eq(illustrationPrompt.id, validatedData.promptId))
          .get();
        if (!prompt) return failJSend(c, "Prompt not found", 400);
      } else if (validatedData.promptText) {
        const summaryModel = "manual";
        const summaryPromptVersion = "manual";
        const newId = defaultPromptId(
          validatedData.songId,
          summaryModel,
          summaryPromptVersion,
        );
        const res = await db
          .insert(illustrationPrompt)
          .values({
            id: newId,
            songId: validatedData.songId,
            summaryModel,
            summaryPromptVersion,
            text: validatedData.promptText,
          })
          .returning();
        prompt = res[0];
      } else {
        prompt = await createManualPrompt(db, validatedData.songId);
      }

      if (
        await sameParametersExist(
          db,
          validatedData.songId,
          prompt.id,
          validatedData.imageModel,
        )
      ) {
        return failJSend(c, "Illustration exists", 400);
      }

      const { imageURL, thumbnailURL } = await processAndUploadImages(
        imageFile,
        illustrationSong.id,
        prompt.id,
        validatedData.imageModel,
        c.env,
      );
      if (!imageURL || !thumbnailURL) return failJSend(c, "Missing image", 400);

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
          illustration: newIllustration[0],
          prompt,
        } as AdminIllustrationResponse,
        201,
      );
    },
  )
  .put("/:id", zValidatorJSend("form", illustrationModifySchema), async (c) => {
    const illustrationId = c.req.param("id");
    const db = c.var.db;
    const parsedData = c.req.valid("form");

    const current = await db
      .select()
      .from(songIllustration)
      .where(
        and(
          eq(songIllustration.id, illustrationId),
          eq(songIllustration.deleted, false),
        ),
      )
      .get();
    if (!current) return itemNotFoundFail(c, "illustration");

    const targetModel = parsedData.imageModel || current.imageModel;
    const { imageURL, thumbnailURL } = await processAndUploadImages(
      parsedData.imageFile,
      current.songId,
      current.promptId,
      targetModel,
      c.env,
    );

    const updateData: {
      imageModel: string;
      updatedAt: Date;
      imageURL?: string;
      thumbnailURL?: string;
    } = {
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
        .get();
      if (currentSong?.currentIllustrationId === illustrationId)
        await clearCurrentIllustration(db, current.songId);
    }

    return successJSend(c, updatedIllustration[0] as SongIllustrationDB);
  })
  .post(
    "/generate",
    zValidatorJSend("json", illustrationGenerateRequestSchema),
    async (c) => {
      const data = await resolveGenerationModels(c.env.KV, c.req.valid("json"));
      // Synchronous execution for the Admin UI
      try {
        const result = await coreGenerateIllustration(c.env, c.var.db, data);
        return successJSend(c, result, 201);
      } catch (error) {
        if (!(error instanceof OpenAI.APIError)) throw error;

        const code = error.code ?? "OPENAI_API_ERROR";
        const blocked = code === "moderation_blocked";
        const message = blocked
          ? "OpenAI blocked the illustration"
          : "OpenAI could not generate the illustration";
        return errorJSend(
          c,
          `${message} (${code})`,
          blocked ? 400 : 502,
          code,
        );
      }
    },
  )
  .delete("/:id", async (c) => {
    const illustrationId = c.req.param("id");
    const db = c.var.db;

    const existing = await db
      .select()
      .from(songIllustration)
      .where(
        and(
          eq(songIllustration.id, illustrationId),
          eq(songIllustration.deleted, false),
        ),
      )
      .get();
    if (!existing) return failJSend(c, "Illustration not found", 404);

    const currentSong = await db
      .select({ currentIllustrationId: song.currentIllustrationId })
      .from(song)
      .where(eq(song.id, existing.songId))
      .get();
    if (currentSong?.currentIllustrationId === illustrationId)
      await clearCurrentIllustration(db, existing.songId);

    try {
      await moveSongToTrash(
        c.env.R2_BUCKET,
        existing.songId,
        existing.promptId,
        existing.imageModel,
      );
    } catch (e) {
      console.error("Error moving song to trash", e);
    }

    await db
      .update(songIllustration)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(songIllustration.id, illustrationId));
    return successJSend(c, { deletedId: illustrationId });
  })
  .post("/:id/restore", async (c) => {
    const restored = await c.var.db
      .update(songIllustration)
      .set({ deleted: false, updatedAt: new Date() })
      .where(eq(songIllustration.id, c.req.param("id")))
      .returning();
    return successJSend(c, {
      restoredIllustration: restored[0] as SongIllustrationDB,
    });
  });

// this function is available for trusted users too --> used in different endpoint than the one for admins
export const trustedGenerateRoute = buildApp().post(
  "/generate",
  zValidatorJSend(
    "json",
    illustrationGenerateRequestSchema.extend({
      promptVersion: z
        .enum(SUMMARY_PROMPT_VERSIONS)
        .default(SUMMARY_PROMPT_VERSIONS[0]),
      summaryModel: illustrationDefaultsSchema.shape.summaryModel.optional(),
    }),
  ),
  async (c) => {
    const data = await resolveGenerationModels(c.env.KV, c.req.valid("json"));
    await c.env.ILLUSTRATION_QUEUE.send(data);
    return successJSend(
      c,
      { status: "processing", message: "Queued for background generation." },
      202,
    );
  },
);
