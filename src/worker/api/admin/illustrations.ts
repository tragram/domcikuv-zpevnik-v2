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
} from "../../services/illustration-service";
import { findSong, SongWithCurrentVersion } from "../../services/song-service";
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
} from "./image-generator";
import { defaultIllustrationId, defaultPromptId } from "~/types/songData";

const illustrationCreateSchema = z.object({
  songId: z.string(),
  summaryPromptId: z.string().optional(),
  imageModel: z.string(),
  setAsActive: z.string().transform((val) => val === "true"), // FormData sends as string
  imageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
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
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
  setAsActive: z.boolean().optional(),
});

const CFImagesThumbnailURL = (imageURL: string) => {
  return "/cdn-cgi/image/width=128/" + imageURL;
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

      // Convert FormData to object for Zod validation
      const formDataObj = Object.fromEntries(formData.entries());
      const validatedData = illustrationCreateSchema.parse(formDataObj);

      // Extract files separately since they don't convert well with Object.fromEntries
      const imageFile = formData.get("imageFile") as File | null;
      const thumbnailFile = formData.get("thumbnailFile") as File | null;
      const db = drizzle(c.env.DB);

      // Verify the song exists
      let illustrationSong;
      try {
        illustrationSong = (await findSong(
          db,
          validatedData.songId
        )) as SongWithCurrentVersion;
      } catch {
        return failJSend(c, "Referenced song not found", 400, "SONG_NOT_FOUND");
      }

      // TODO: copy these to R2
      let imageURL = validatedData.imageURL || "";
      let thumbnailURL = validatedData.thumbnailURL || "";

      // TODO: allow user to enter a custom prompt they used
      // Create or find the prompt
      let prompt;
      try {
        prompt = await createOrFindManualPrompt(
          db,
          validatedData.songId,
          validatedData.summaryPromptId
        );
      } catch (error) {
        return error instanceof Error
          ? errorFail(c, error)
          : failJSend(c, "Invalid prompt ID", 400, "INVALID_PROMPT_ID");
      }

      // Handle file uploads with proper validation
      if (imageFile && imageFile instanceof File) {
        const imageBuffer = await imageFile.arrayBuffer();
        imageURL = await uploadImageBuffer(
          imageBuffer,
          illustrationSong.id,
          prompt.id,
          validatedData.imageModel,
          c.env
        );
      }

      if (thumbnailFile && thumbnailFile instanceof File) {
        const thumbnailBuffer = await thumbnailFile.arrayBuffer();
        thumbnailURL = await uploadImageBuffer(
          thumbnailBuffer,
          illustrationSong.id,
          prompt.id,
          validatedData.imageModel,
          c.env,
          true
        );
      } else if (imageURL && !thumbnailURL) {
        // Use Cloudflare Images to generate thumbnail from main image
        thumbnailURL = CFImagesThumbnailURL(imageURL);
      }

      // Validate that we have both URLs
      if (!imageURL || !thumbnailURL) {
        return failJSend(
          c,
          "Either provide URLs or upload files for both image and thumbnail",
          400,
          "MISSING_IMAGE_DATA"
        );
      }

      if (
        await sameParametersExist(
          db,
          validatedData.songId,
          prompt.id,
          validatedData.imageModel
        )
      ) {
        return failJSend(
          c,
          "Illustration with the same parameters already exists.",
          400,
          "ILLUSTRATION_DUPLICATE"
        );
      }

      const newId = defaultIllustrationId(prompt.id, validatedData.imageModel);
      const insertData = {
        id: newId,
        songId: validatedData.songId,
        imageModel: validatedData.imageModel,
        imageURL: imageURL,
        thumbnailURL: thumbnailURL,
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false,
        promptId: prompt.id,
      };

      const newIllustration = await db
        .insert(songIllustration)
        .values(insertData)
        .returning();

      // If this illustration should be set as active, update the song's currentIllustrationId
      if (validatedData.setAsActive) {
        await setCurrentIllustration(db, validatedData.songId, newId);
      }

      return successJSend(
        c,
        {
          song: illustrationSong,
          illustration: newIllustration[0] as SongIllustrationDB,
          prompt: prompt,
        },
        201
      );
    } catch (error) {
      console.error("Error creating manual illustration:", error);
      return errorJSend(
        c,
        "Failed to create manual illustration",
        500,
        "CREATE_ERROR"
      );
    }
  })

  .post(
    "/generate",
    zValidator("json", illustrationGenerateSchema),
    async (c) => {
      try {
        const illustrationData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify the song exists
        let illustrationSong;
        try {
          illustrationSong = (await findSong(
            db,
            illustrationData.songId
          )) as SongWithCurrentVersion;
        } catch {
          return songNotFoundFail(c);
        }

        // Validate API keys
        if (!c.env.OPENAI_API_KEY || !c.env.HUGGING_FACE_TOKEN) {
          console.error("Missing required API keys for image generation!");
          return errorJSend(
            c,
            "Missing required API keys for image generation!",
            500,
            "MISSING_API_KEYS"
          );
        }

        // Create image generator
        const generationConfig: GenerationConfig = {
          promptVersion: illustrationData.promptVersion,
          summaryModel: illustrationData.summaryModel,
          imageModel: illustrationData.imageModel,
          openaiApiKey: c.env.OPENAI_API_KEY,
          huggingFaceToken: c.env.HUGGING_FACE_TOKEN,
          openaiOrgId: c.env.OPENAI_ORGANIZATION_ID,
          openaiProjectId: c.env.OPENAI_PROJECT_ID,
        };

        const generator = new ImageGenerator(generationConfig);

        // Find or create prompt
        const prompt = await findOrCreatePrompt(
          db,
          c,
          illustrationData.songId,
          illustrationData.promptVersion,
          illustrationData.summaryModel,
          generator,
          illustrationSong
        );

        if (
          await sameParametersExist(
            db,
            illustrationData.songId,
            prompt.id,
            illustrationData.imageModel
          )
        ) {
          return failJSend(
            c,
            "Illustration with the same parameters already exists.",
            400,
            "DUPLICATE_ILLUSTRATION"
          );
        }

        const imageBuffer = await generator.generateImage(prompt.text);
        const promptId = defaultPromptId(
          illustrationData.songId,
          illustrationData.summaryModel,
          illustrationData.promptVersion
        );
        const imageId = defaultIllustrationId(
          promptId,
          illustrationData.imageModel
        );
        const imageURL = await uploadImageBuffer(
          imageBuffer,
          illustrationSong.id,
          promptId,
          illustrationData.imageModel,
          c.env
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

        // If this illustration should be set as active, update the song's currentIllustrationId
        if (illustrationData.setAsActive) {
          await setCurrentIllustration(db, illustrationData.songId, imageId);
        }

        return successJSend(
          c,
          {
            song: illustrationSong,
            illustration: newIllustration[0] as SongIllustrationDB,
            prompt,
          },
          201
        );
      } catch (error) {
        console.error("Error generating illustration:", error);
        return errorJSend(
          c,
          "Failed to create illustration",
          500,
          "CREATE_ERROR"
        );
      }
    }
  )

  .put("/:id", zValidator("json", illustrationModifySchema), async (c) => {
    try {
      const modifiedIllustration = c.req.valid("json");
      const db = drizzle(c.env.DB);
      const illustrationId = c.req.param("id");

      // Check if illustration exists and get its song ID
      const existingIllustration = await db
        .select({
          id: songIllustration.id,
          songId: songIllustration.songId,
          promptId: songIllustration.promptId,
        })
        .from(songIllustration)
        .where(
          and(
            eq(songIllustration.id, illustrationId),
            eq(songIllustration.deleted, false)
          )
        )
        .limit(1);

      if (existingIllustration.length === 0) {
        return itemNotFoundFail(c, "illustration");
      }
      const songId = existingIllustration[0].songId;

      // Prepare update data (excluding setAsActive which we handle separately)
      const { setAsActive, ...updateData } = modifiedIllustration;

      const updatedIllustration = await db
        .update(songIllustration)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(songIllustration.id, illustrationId))
        .returning();

      // Handle setting as active illustration
      if (setAsActive === true) {
        await setCurrentIllustration(db, songId, illustrationId);
      } else if (setAsActive === false) {
        // Check if this illustration is currently active and clear it if so
        const currentSong = await db
          .select({ currentIllustrationId: song.currentIllustrationId })
          .from(song)
          .where(eq(song.id, songId))
          .limit(1);

        if (currentSong[0]?.currentIllustrationId === illustrationId) {
          await clearCurrentIllustration(db, songId);
        }
      }

      let illustrationSong;
      try {
        illustrationSong = (await findSong(
          db,
          songId
        )) as SongWithCurrentVersion;
      } catch {
        return songNotFoundFail(c);
      }

      // Fetch the prompt
      const promptResult = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, existingIllustration[0].promptId))
        .limit(1);
      const prompt = promptResult[0];

      return successJSend(c, {
        song: illustrationSong,
        illustration: updatedIllustration[0] as SongIllustrationDB,
        prompt,
      });
    } catch (error) {
      console.error("Error modifying illustration:", error);
      return errorJSend(
        c,
        "Failed to modify illustration",
        500,
        "UPDATE_ERROR"
      );
    }
  })

  .delete("/:id", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Basic ID validation
      if (!illustrationId || illustrationId.length < 10) {
        return failJSend(
          c,
          "Invalid illustration ID format",
          400,
          "INVALID_ID"
        );
      }

      // Check if illustration exists
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
            eq(songIllustration.deleted, false)
          )
        )
        .limit(1);

      if (existingIllustration.length === 0) {
        return failJSend(
          c,
          "Illustration not found",
          404,
          "ILLUSTRATION_NOT_FOUND"
        );
      }

      const songId = existingIllustration[0].songId;

      // Check if this illustration is currently active and clear it if so
      const currentSong = await db
        .select({ currentIllustrationId: song.currentIllustrationId })
        .from(song)
        .where(eq(song.id, songId))
        .limit(1);

      if (currentSong[0]?.currentIllustrationId === illustrationId) {
        await clearCurrentIllustration(db, songId);
      }

      // Delete associated files from R2 storage (if stored there)
      try {
        await moveSongToTrash(
          c.env.R2_BUCKET,
          songId,
          existingIllustration[0].promptId,
          existingIllustration[0].imageModel
        );
      } catch (e) {}

      // Soft delete the illustration instead of hard delete
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
        "DELETE_ERROR"
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
        "RESTORE_ERROR"
      );
    }
  });
