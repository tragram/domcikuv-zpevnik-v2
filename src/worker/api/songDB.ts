import { zValidator } from "@hono/zod-validator";
import { and, eq, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songVersion,
} from "src/lib/db/schema";
import { z } from "zod/v4";
import {
  baseSelectFields,
  createSong,
  findSong,
  getSongbooks,
  retrieveSongs,
  SongDataApi,
} from "../services/song-service";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";
import { SongData } from "~/types/songData";
import { convertToChordPro } from "~/lib/chords2chordpro";
import { guessLanguage } from "~/lib/utils";
import { ChordProParser } from "chordproject-parser";
import { EditorSubmitSchema } from "./editor";
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
  .get("/fetch/:id", async (c) => {
    const songId = c.req.param("id");
    const db = drizzle(c.env.DB);

    try {
      const foundSong = await findSong(db, songId, true);
      if (!songId || typeof songId !== "string") {
        return failJSend(c, "Invalid song ID", 400);
      }
      if (!foundSong) {
        return failJSend(c, "Song not found", 404);
      }
      return successJSend(c, foundSong);
    } catch (e) {
      return errorJSend(c, "Error fetching song", 500);
    }
  })
  .get("/import/pa/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = drizzle(c.env.DB);
    const user = c.get("USER");

    if (!user)
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

    try {
      // scrape the song
      const url = `https://pisnicky-akordy.cz/${slug}`;
      const response = await fetch(url);
      if (!response.ok) return errorJSend(c, "Source fetch failed", 502);

      let lyricsHtml = "";
      let title = "";
      let artist = "";

      const rewriter = new HTMLRewriter()
        .on("div#songtext pre", {
          text(text) {
            lyricsHtml += text.text;
          },
        })
        .on("h1", {
          text(text) {
            if (text.text.trim()) title = text.text.trim();
          },
        })
        .on("h2", {
          text(text) {
            if (text.text.trim()) artist = text.text.trim();
          },
        });

      await rewriter.transform(response).text();
      const chordPro = convertToChordPro(lyricsHtml);
      if (!lyricsHtml || !artist || !title)
        return failJSend(c, "Error scraping song", 500, "IMPORT_ERROR");

      // check if the song (by artist/title ID) already exists
      const newSongId = SongData.baseId(title, artist);
      const existingSong = await db
        .select({ id: song.id })
        .from(song)
        .where(and(eq(song.id, newSongId), song.currentVersionId))
        .limit(1);
      const songExists = existingSong.length > 0;
      if (songExists)
        return errorJSend(c, "Song already exists in DB", 422, newSongId);

      // database write
      const submission: EditorSubmitSchema = {
        title: title,
        artist: artist,
        language: guessLanguage(chordPro),
        chordpro: chordPro,
        key:
          new ChordProParser().parse(chordPro).getPossibleKey()?.toString() ??
          null,
        capo: null,
        range: null,
        startMelody: null,
        tempo: null,
      };
      const { newSong } = await createSong(
        db,
        submission,
        user.id,
        true,
        "pisnicky-akordy",
      );

      return successJSend(c, { songId: newSong.id });
    } catch (error) {
      console.error("Import error:", error);
      return errorJSend(c, "Import failed", 500);
    }
  })

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
