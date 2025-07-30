import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import z from "zod/v4";
import { illustrationBaseId, SongData } from "~/types/songData";
import {
  illustrationPrompt,
  IllustrationPromptDB,
  SongDataDB,
  songIllustration,
  SongIllustrationDB,
} from "../../../lib/db/schema";
import { buildApp } from "../utils";
import {
  createOrFindManualPrompt,
  findOrCreatePrompt,
  illustrationPromptRoutes,
} from "./illustration-prompts";
import {
  GenerationConfig,
  IMAGE_MODELS_API,
  ImageGenerator,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "./image-generator";
import { findSong } from "./songs";

const illustrationCreateSchema = z.object({
  songId: z.string(),
  summaryPromptId: z.string().optional(),
  imageModel: z.string(),
  isActive: z.string().transform((val) => val === "true"), // FormData sends as string
  imageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
});

const illustrationGenerateSchema = z.object({
  songId: z.string(),
  isActive: z.boolean().default(false),
  imageModel: z.enum(IMAGE_MODELS_API),
  promptVersion: z.enum(SUMMARY_PROMPT_VERSIONS),
  summaryModel: z.enum(SUMMARY_MODELS_API),
});

const illustrationModifySchema = z.object({
  id: z.string(),
  imageModel: z.string().optional(),
  imageURL: z.string().optional(),
  thumbnailURL: z.string().optional(),
  isActive: z.boolean().optional(),
});

const CFImagesThumbnailURL = (imageURL: string) => {
  return "/cdn-cgi/image/width=128/" + imageURL;
};

export type IllustrationCreateSchema = z.infer<typeof illustrationCreateSchema>;
export type IllustrationGenerateSchema = z.infer<
  typeof illustrationGenerateSchema
>;
export type IllustrationModifySchema = z.infer<typeof illustrationModifySchema>;
export type adminIllustrationResponse = {
  song: SongDataDB;
  illustration: SongIllustrationDB;
  prompt: IllustrationPromptDB;
};

const commonR2Key2Folder = (commonR2Key: string, thumbnail: boolean) => {
  return `songs/${
    thumbnail ? "illustration_thumbnails" : "illustrations"
  }/${commonR2Key}`;
};

/**
 * Helper function to upload image buffers to storage and return URLs
 */
async function uploadImageBuffer(
  imageBuffer: ArrayBuffer,
  song: SongDataDB,
  filename: string,
  env: any,
  thumbnail: boolean = false
) {
  const commonR2Key = `${SongData.baseId(song.artist, song.title)}/${filename}`;
  const imageKey = commonR2Key2Folder(commonR2Key, thumbnail);
  await env.R2_BUCKET.put(imageKey, imageBuffer);
  const imageURL = `${env.CLOUDFLARE_R2_URL}/${imageKey}`;
  return { imageURL, commonR2Key };
}

async function sameParametersExist(
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
        eq(songIllustration.imageModel, imageModel)
      )
    )
    .limit(1);
  return (await result).length > 0;
}

export const illustrationRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrations = await db.select().from(songIllustration);
    return c.json(
      {
        status: "success",
        data: illustrations,
      },
      200
    );
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
        illustrationSong = await findSong(db, validatedData.songId);
      } catch {
        return c.json(
          {
            status: "fail",
            failData: { message: "Referenced song not found" },
          },
          400
        );
      }

      let imageURL = validatedData.imageURL || "";
      let thumbnailURL = validatedData.thumbnailURL || "";
      let commonR2Key;

      // Handle file uploads with proper validation
      if (imageFile && imageFile instanceof File) {
        const imageBuffer = await imageFile.arrayBuffer();
        const filename = `manual_${Date.now()}_${imageFile.name || "image"}`;
        ({ imageURL, commonR2Key } = await uploadImageBuffer(
          imageBuffer,
          illustrationSong,
          filename,
          c.env
        ));
      }

      if (thumbnailFile && thumbnailFile instanceof File) {
        const thumbnailBuffer = await thumbnailFile.arrayBuffer();
        const thumbnailFilename = `${Date.now()}_${
          thumbnailFile.name || "thumbnail"
        }`;
        ({ imageURL: thumbnailURL } = await uploadImageBuffer(
          thumbnailBuffer,
          illustrationSong,
          thumbnailFilename,
          c.env,
          true
        ));
      } else if (imageURL && !thumbnailURL) {
        // Use Cloudflare Images to generate thumbnail from main image
        thumbnailURL = CFImagesThumbnailURL(imageURL);
      }

      // Validate that we have both URLs
      if (!imageURL || !thumbnailURL) {
        return c.json(
          {
            status: "fail",
            failData: {
              files:
                "Either provide URLs or upload files for both image a nd thumbnail",
            },
          },
          400
        );
      }
      // Create or find the prompt
      let prompt;
      try {
        prompt = await createOrFindManualPrompt(
          db,
          validatedData.songId,
          validatedData.summaryPromptId
        );
      } catch (error) {
        return c.json(
          {
            status: "fail",
            failData: {
              summaryPromptId:
                error instanceof Error ? error.message : "Invalid prompt ID",
            },
          },
          400
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
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Illustration with the same parameters already exists.",
            },
          },
          400
        );
      }
      if (validatedData.isActive) {
        // If this illustration is being set as active, deactivate all other illustrations for this song
        await db
          .update(songIllustration)
          .set({ isActive: false })
          .where(eq(songIllustration.songId, validatedData.songId));
      }

      // Generate unique ID
      const newId = `${validatedData.songId}_${prompt.id}_${
        validatedData.imageModel
      }_${Date.now()}`;

      const insertData = {
        id: newId,
        songId: validatedData.songId,
        imageModel: validatedData.imageModel,
        imageURL: imageURL,
        thumbnailURL: thumbnailURL,
        commonR2Key,
        isActive: validatedData.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
        promptId: prompt.id,
      };

      const newIllustration = await db
        .insert(songIllustration)
        .values(insertData)
        .returning();

      return c.json(
        {
          status: "success",
          data: {
            song: illustrationSong,
            illustration: newIllustration[0] as SongIllustrationDB,
            prompt: prompt,
          } as adminIllustrationResponse,
        },
        201
      );
    } catch (error) {
      console.error("Error creating manual illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to create manual illustration",
          code: "CREATE_ERROR",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
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
        console.log(illustrationData);
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

        // Validate API keys
        if (!c.env.OPENAI_API_KEY || !c.env.HUGGING_FACE_TOKEN) {
          console.error("Missing required API keys for image generation!");
          return c.json(
            {
              status: "error",
              message: "Missing required API keys for image generation!",
              code: "MISSING_API_KEYS",
            },
            500
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
          return c.json(
            {
              status: "fail",
              failData: {
                message:
                  "Illustration with the same parameters already exists.",
              },
            },
            400
          );
        }

        const imageBuffer = await generator.generateImage(prompt.text);
        console.log(imageBuffer);
        const filename = illustrationBaseId(
          { imageModel: illustrationData.imageModel },
          {
            promptVersion: illustrationData.promptVersion,
            summaryModel: illustrationData.summaryModel,
          }
        );
        console.log(filename);

        const { imageURL, commonR2Key } = await uploadImageBuffer(
          imageBuffer,
          illustrationSong,
          filename,
          c.env
        );
        console.log(imageURL, commonR2Key);

        // If this illustration is being set as active, deactivate all other illustrations for this song
        if (illustrationData.isActive) {
          await db
            .update(songIllustration)
            .set({ isActive: false })
            .where(eq(songIllustration.songId, illustrationData.songId));
        }

        // Generate unique ID
        const newId = `${illustrationData.songId}_${prompt.id}_${
          illustrationData.imageModel
        }_${Date.now()}`;

        const insertData = {
          id: newId,
          songId: illustrationData.songId,
          imageModel: illustrationData.imageModel,
          imageURL: imageURL,
          thumbnailURL: CFImagesThumbnailURL(imageURL),
          commonR2Key,
          isActive: illustrationData.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
          promptId: prompt.id,
        };

        const newIllustration = await db
          .insert(songIllustration)
          .values(insertData)
          .returning();
        console.log(newIllustration);
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
        console.error("Error generating illustration:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to create illustration",
            code: "CREATE_ERROR",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

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
        .select({
          id: songIllustration.id,
          imageURL: songIllustration.imageURL,
          thumbnailURL: songIllustration.thumbnailURL,
          commonR2Key: songIllustration.commonR2Key,
        })
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
      // delete associated files from R2 storage (if stored there)
      if (existingIllustration[0].commonR2Key) {
        c.env.R2_BUCKET.delete(
          commonR2Key2Folder(existingIllustration[0].commonR2Key, false)
        );
        c.env.R2_BUCKET.delete(
          commonR2Key2Folder(existingIllustration[0].commonR2Key, true)
        );
      }

      await db
        .delete(songIllustration)
        .where(eq(songIllustration.id, illustrationId));

      return c.json({
        status: "success",
        data: { deletedId: illustrationId },
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
