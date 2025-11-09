import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { illustrationPrompt } from "src/lib/db/schema";
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
          isIncremental
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
    }
  )
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

  .get("prompts/:id", async (c) => {
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
        "ERROR_FINDING_PROMPT"
      );
    }
  });

export default songDBRoutes;
