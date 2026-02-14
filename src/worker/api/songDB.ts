import { zValidator } from "@hono/zod-validator";
import { and, eq, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songImport,
} from "src/lib/db/schema";
import { z } from "zod/v4";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";
import { SongData } from "~/types/songData";
import { convertToChordPro } from "~/lib/chords2chordpro";
import { guessLanguage } from "~/lib/utils";
import { ChordProParser } from "chordproject-parser";
import { EditorSubmitSchema } from "./editor";
import {
  SongDataApi,
  retrieveSongs,
  retrieveSingleSong,
  createSong,
  getSongbooks,
  createImportSong,
} from "../helpers/song-helpers";
import {
  externalSongSchema,
  searchAllExternalServices,
} from "../helpers/external-search";
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

    try {
      const songs = await retrieveSongs(db);
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

      try {
        const currentDBVersion = (await c.env.KV.get("songDB-version")) ?? "0";
        const isIncremental = songDBVersion === currentDBVersion;

        const songs = await retrieveSongs(
          db,
          c.get("USER")?.id,
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

    if (!songId || typeof songId !== "string") {
      return failJSend(c, "Invalid song ID", 400);
    }

    const db = drizzle(c.env.DB);

    try {
      const foundSong = await retrieveSingleSong(db, songId);

      if (!foundSong) {
        return failJSend(c, "Song not found", 404);
      }

      return successJSend(c, foundSong);
    } catch (e) {
      return errorJSend(c, "Error fetching song", 500);
    }
  })
  .get("/fetch/:songId/:versionId", async (c) => {
    const songId = c.req.param("songId");
    const versionId = c.req.param("versionId");

    if (!songId || typeof songId !== "string") {
      return failJSend(c, "Invalid song ID", 400);
    }
    if (!versionId || typeof versionId !== "string") {
      return failJSend(c, "Invalid version ID", 400);
    }

    const db = drizzle(c.env.DB);

    try {
      const foundSong = await retrieveSingleSong(db, songId, versionId);

      if (!foundSong) {
        return failJSend(c, "Song not found", 404);
      }

      return successJSend(c, foundSong);
    } catch (e) {
      return errorJSend(c, "Error fetching song", 500);
    }
  })
  .post("/import", zValidator("json", externalSongSchema), async (c) => {
    const { id, title, artist, url, externalSource } = c.req.valid("json");
    const db = drizzle(c.env.DB);
    const user = c.get("USER");

    if (!user)
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

    try {
      // Check if the song (by artist/title ID) already exists
      const newSongId = SongData.baseId(title, artist);
      const existingSong = await db
        .select({ id: song.id })
        .from(song)
        .where(and(eq(song.id, newSongId), song.currentVersionId))
        .limit(1);

      if (existingSong.length > 0)
        return errorJSend(c, "Song already exists in DB", 422, newSongId);

      // Fetch the source page
      const response = await fetch(url);
      if (!response.ok) return errorJSend(c, "Source fetch failed", 502);

      let lyricsHtml = "";

      // Source-specific scraping (only for lyrics!)
      const rewriter = new HTMLRewriter();

      if (externalSource === "pisnicky-akordy") {
        rewriter.on("div#songtext pre", {
          text(text) {
            lyricsHtml += text.text;
          },
        });
      } else if (externalSource === "cifraclub") {
        // Example selector for CifraClub, adjust to match their DOM
        rewriter.on("pre", {
          text(text) {
            lyricsHtml += text.text;
          },
        });
      } else {
        return failJSend(c, "Unsupported external source", 400);
      }

      await rewriter.transform(response).text();

      if (!lyricsHtml)
        return failJSend(c, "Error scraping song lyrics", 500, "IMPORT_ERROR");

      const chordPro = convertToChordPro(
        lyricsHtml,
        // non-czech sources need to have chords converted
        ["cifraclub"].includes(externalSource),
      );

      const importId = await createImportSong(
        db,
        title,
        artist,
        lyricsHtml,
        url,
        user.id,
        externalSource,
      );

      // Database write
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
        importId,
      );

      return successJSend(c, { songId: newSong.id });
    } catch (error) {
      console.error("Import error:", error);
      return errorJSend(c, "Import failed", 500);
    }
  })

  .get("/external-search", async (c) => {
    const query = c.req.query("q");
    const user = c.get("USER");

    if (!user) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    if (!query || query.trim().length < 3) {
      return successJSend(c, []);
    }

    try {
      const results = await searchAllExternalServices(
        query,
        c.env.PA_BEARER_TOKEN,
      );
      return successJSend(c, results);
    } catch (error) {
      console.error("External search failed:", error);
      return errorJSend(c, "Failed to fetch external songs", 500);
    }
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
