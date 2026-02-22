import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import z from "zod/v4";
import { defaultIllustrationId, defaultPromptId } from "~/types/songData";
import {
  illustrationPrompt,
  song,
  songIllustration,
  SongIllustrationDB,
} from "../../../lib/db/schema";
import {
  AdminIllustrationResponse,
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
  IMAGE_MODELS_API,
  ImageGenerator,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "../../helpers/image-generator";
import {
  errorJSend,
  failJSend,
  itemNotFoundFail,
  songNotFoundFail,
  successJSend,
} from "../responses";
import { buildApp } from "../utils";
import {
  getSongPopulated,
  PopulatedSongDB,
} from "src/worker/helpers/song-helpers";

const illustrationCreateSchema = z.object({
  songId: z.string(),
  imageModel: z.string(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true),
  imageFile: z.any().optional(),
  promptId: z.string().optional(),
  promptText: z.string().optional(),
  summaryModel: z.string().optional(),
  summaryPromptVersion: z.string().optional(),
});

const illustrationGenerateSchema = z.object({
  songId: z.string(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true),
  imageModel: z.enum(IMAGE_MODELS_API),
  promptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
  summaryModel: z.enum(SUMMARY_MODELS_API),
});

const illustrationModifySchema = z.object({
  imageModel: z.string().optional(),
  setAsActive: z
    .union([z.string(), z.boolean()])
    .transform((val) => val === "true" || val === true),
});

export const CFImagesThumbnailURL = (imageURL: string) =>
  `/cdn-cgi/image/width=128/${imageURL}`;

const generateIllustrationHandler = async (c: any) => {
  const illustrationData = c.req.valid("json");
  const db = c.var.db;

  let illustrationSong: PopulatedSongDB;
  try {
    illustrationSong = await getSongPopulated(db, illustrationData.songId);
  } catch {
    return songNotFoundFail(c);
  }

  if (!c.env.OPENAI_API_KEY || !c.env.HUGGING_FACE_TOKEN) {
    return errorJSend(c, "Missing API keys", 500, "MISSING_API_KEYS");
  }

  const generator = new ImageGenerator({
    promptVersion: illustrationData.promptVersion,
    summaryModel: illustrationData.summaryModel,
    imageModel: illustrationData.imageModel,
    openaiApiKey: c.env.OPENAI_API_KEY,
    googleApiKey: c.env.GOOGLE_API_KEY,
    huggingFaceToken: c.env.HUGGING_FACE_TOKEN,
  });

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
    return failJSend(c, "Illustration exists.", 400, "DUPLICATE_ILLUSTRATION");
  }

  const imageBuffer = await generator.generateImage(prompt.text);
  const promptId = defaultPromptId(
    illustrationData.songId,
    illustrationData.summaryModel,
    illustrationData.promptVersion,
  );
  const imageId = defaultIllustrationId(promptId, illustrationData.imageModel);
  const imageURL = await uploadImageBuffer(
    imageBuffer,
    illustrationSong.id,
    promptId,
    illustrationData.imageModel,
    c.env,
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

  if (illustrationData.setAsActive)
    await setCurrentIllustration(
      db,
      illustrationData.songId,
      newIllustration[0].id,
    );
  return successJSend(
    c,
    {
      song: illustrationSong,
      illustration: newIllustration[0] as SongIllustrationDB,
      prompt,
    } as AdminIllustrationResponse,
    201,
  );
};

export const illustrationRoutes = buildApp()
  .get("/", async (c) =>
    successJSend(
      c,
      (await c.var.db.select().from(songIllustration)) as SongIllustrationDB[],
    ),
  )
  .post("/create", async (c) => {
    const formData = await c.req.formData();
    const validatedData = illustrationCreateSchema.parse(
      Object.fromEntries(formData.entries()),
    );
    const imageFile = formData.get("imageFile") as File | null;
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
  })
  .put("/:id", async (c) => {
    const illustrationId = c.req.param("id");
    const db = c.var.db;

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

    let parsedData: any = {};
    if (c.req.header("content-type")?.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      parsedData = illustrationModifySchema.parse(
        Object.fromEntries(formData.entries()),
      );
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

    const updateData: any = { imageModel: targetModel, updatedAt: new Date() };
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
    zValidator("json", illustrationGenerateSchema),
    generateIllustrationHandler,
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

export const trustedGenerateRoute = buildApp().post(
  "/generate",
  zValidator("json", illustrationGenerateSchema),
  generateIllustrationHandler,
);
