import { zValidator } from "@hono/zod-validator";
import { eq, not } from "drizzle-orm";
import { illustrationPrompt, songIllustration } from "src/lib/db/schema";
import { z } from "zod";
import {
  SongDataApi,
  getSongbooks,
  retrieveSingleSong,
  retrieveSongs,
} from "../helpers/song-helpers";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";
import { externalRoutes } from "./external";

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
  .route("/external", externalRoutes)
  .get("/", async (c) => {
    const songs = await retrieveSongs(c.var.db);
    const songDBVersion = (await c.env.KV.get("songDB-version")) ?? "v0";

    return successJSend(c, {
      songs,
      songDBVersion,
      lastUpdateAt: new Date().toISOString(),
      isIncremental: false,
    } as SongDBResponseData);
  })
  .get(
    "/incremental",
    zValidator("query", incrementalUpdateSchema),
    async (c) => {
      const { lastUpdateAt, songDBVersion } = c.req.valid("query");
      const currentDBVersion = (await c.env.KV.get("songDB-version")) ?? "0";
      const isIncremental = songDBVersion === currentDBVersion;

      const songs = await retrieveSongs(
        c.var.db,
        c.var.USER?.id,
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
    },
  )
  .get("/fetch/:id", async (c) => {
    const songId = c.req.param("id");
    const foundSong = await retrieveSingleSong(c.var.db, songId);

    if (!foundSong) return failJSend(c, "Song not found", 404);
    return successJSend(c, foundSong);
  })
  .get("/fetch/:songId/:versionId", async (c) => {
    const { songId, versionId } = c.req.param();
    const foundSong = await retrieveSingleSong(c.var.db, songId, versionId);

    if (!foundSong) return failJSend(c, "Song not found", 404);
    return successJSend(c, foundSong);
  })
  .get("/songbooks", async (c) => {
    const songbooks = await getSongbooks(c.var.db);
    return successJSend(c, songbooks);
  })
  .get("/illustrations", async (c) => {
    const allIlustrations = await c.var.db
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
      allIlustrations.map((ai) => ({
        ...ai,
        createdAt: ai.createdAt.getTime(),
      })),
    );
  })
  .get("/prompts", async (c) => {
    const allPrompts = await c.var.db
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
      allPrompts.map((ap) => ({ ...ap, createdAt: ap.createdAt.getTime() })),
    );
  })
  .get("/prompts/:id", async (c) => {
    const existingPrompt = await c.var.db
      .select()
      .from(illustrationPrompt)
      .where(eq(illustrationPrompt.id, c.req.param("id")))
      .get();

    if (!existingPrompt) {
      return failJSend(
        c,
        "Referenced prompt not found",
        404,
        "PROMPT_NOT_FOUND",
      );
    }
    return successJSend(c, existingPrompt);
  });

export default songDBRoutes;
