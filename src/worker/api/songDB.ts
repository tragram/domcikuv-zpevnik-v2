import { zValidator } from "@hono/zod-validator";
import { eq, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { illustrationPrompt, songIllustration } from "src/lib/db/schema";
import { z } from "zod/v4";
import {
  getSongbooks,
  retrieveSongs,
  SongDataApi,
} from "../services/song-service";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";

const incrementalUpdateSchema = z.object({
  songDBVersion: z.string(),
  lastUpdateAt: z.string().transform((str) => new Date(str)),
});

export type SongDBResponseData = {
  songs: SongDataApi[];
  songDBVersion: string;
  lastUpdateAt: string;
  isIncremental: boolean;
};

export type BasicIllustrationPromptDB = {
  promptId: string;
  songId: string;
  createdAt: number;
  summaryPromptVersion: string;
  summaryModel: string;
  text: string;
};

export type BasicSongIllustrationDB = {
  promptId: string;
  songId: string;
  createdAt: number;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
};

export type AllIllustrationPromptsResponseData = BasicIllustrationPromptDB[];
export type BasicSongIllustrationResponseData = BasicSongIllustrationDB[];

export const songDBRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;

    try {
      const songs = await retrieveSongs(db, userId);
      const songDBVersion = (await c.env.KV.get("songDB-version")) ?? "v0";
      return successJSend(c, {
        songs,
        songDBVersion,
        lastUpdateAt: new Date().toISOString(),
        isIncremental: false,
      } as SongDBResponseData);
    } catch (error) {
      console.error("Database error:", error);
      return errorJSend(c, "Failed to fetch songs", 500);
    }
  })
  .get(
    "/incremental",
    zValidator("query", incrementalUpdateSchema),
    async (c) => {
      const { lastUpdateAt, songDBVersion } = c.req.valid("query");
      const db = drizzle(c.env.DB);
      const userId = c.get("USER")?.id;

      try {
        const currentDBVersion = (await c.env.KV.get("songDB-version")) ?? "0";
        const isIncremental = songDBVersion === currentDBVersion;

        const songs = await retrieveSongs(
          db,
          userId,
          isIncremental ? lastUpdateAt : undefined,
          isIncremental,
          isIncremental,
        );

        return successJSend(c, {
          songs,
          songDBVersion: currentDBVersion,
          lastUpdateAt: new Date().toISOString(),
          isIncremental,
        } as SongDBResponseData);
      } catch (error) {
        console.error("Database error:", error);
        return errorJSend(c, "Failed to fetch incremental update", 500);
      }
    },
  )
  .get("/info/pa_token", async (c) => {
    const userId = c.get("USER")?.id;
    if (userId) {
      return successJSend(c, { PAToken: c.env.PA_BEARER_TOKEN });
    } else return errorJSend(c, "User not authenticated", 401);
  })
  .get("/songbooks", async (c) => {
    const db = drizzle(c.env.DB);
    try {
      const songbooks = await getSongbooks(db);
      return successJSend(c, songbooks);
    } catch (error) {
      console.error("Database error:", error);
      return errorJSend(c, "Failed to fetch songbooks", 500);
    }
  })

  .get("/illustrations", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const allIlustrations = await db
        .select({
          songId: songIllustration.songId,
          promptId: songIllustration.promptId,
          createdAt: songIllustration.createdAt,
          imageModel: songIllustration.imageModel,
          imageURL: songIllustration.imageURL,
          thumbnailURL: songIllustration.thumbnailURL,
        })
        .from(songIllustration)
        .where(not(songIllustration.deleted));
      return successJSend(
        c,
        allIlustrations.map((ai) => {
          return { ...ai, createdAt: ai.createdAt.getTime() };
        }) as BasicSongIllustrationResponseData,
      );
    } catch {
      return errorJSend(
        c,
        "Internal error listing illustrations",
        500,
        "ERROR_FINDING_PROMPT",
      );
    }
  })

  .get("/prompts", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const allPrompts = await db
        .select({
          promptId: illustrationPrompt.id,
          songId: illustrationPrompt.songId,
          createdAt: illustrationPrompt.createdAt,
          summaryPromptVersion: illustrationPrompt.summaryPromptVersion,
          summaryModel: illustrationPrompt.summaryModel,
          text: illustrationPrompt.text,
        })
        .from(illustrationPrompt)
        .where(not(illustrationPrompt.deleted));
      return successJSend(
        c,
        allPrompts.map((ap) => {
          return { ...ap, createdAt: ap.createdAt.getTime() };
        }) as AllIllustrationPromptsResponseData,
      );
    } catch {
      return errorJSend(
        c,
        "Internal error listing prompts",
        500,
        "ERROR_FINDING_PROMPT",
      );
    }
  })

  .get("/prompts/:id", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const existingPrompt = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.id, c.req.param("id")))
        .limit(1);

      if (existingPrompt.length === 0) {
        return failJSend(c, "Referenced song not found", 400, "VERSION_EXISTS");
      }
      return successJSend(c, existingPrompt[0]);
    } catch {
      return errorJSend(
        c,
        "Internal error finding prompt",
        500,
        "ERROR_FINDING_PROMPT",
      );
    }
  });

export default songDBRoutes;
