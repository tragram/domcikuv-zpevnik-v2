import { zValidator } from "@hono/zod-validator";
import { ChordProParser } from "chordproject-parser";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { song } from "src/lib/db/schema";
import { convertToChordPro } from "~/lib/chords2chordpro";
import { guessLanguage } from "~/lib/utils";
import { SongData } from "~/types/songData";
import {
  externalSongSchema,
  searchAllExternalServices,
} from "../helpers/external-search";
import { addIllustrationFromURL } from "../helpers/illustration-helpers";
import { createImportSong, createSong } from "../helpers/song-helpers";
import { EditorSubmitSchema } from "./editor";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";

export const externalRoutes = buildApp()
  .get("/search", async (c) => {
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
  .post("/import", zValidator("json", externalSongSchema), async (c) => {
    const { id, title, artist, url, externalSource, thumbnailURL } =
      c.req.valid("json");
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

      // TODO: if song is "fake-deleted", it won't show up in the search and this will crash
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
      if (thumbnailURL) {
        await addIllustrationFromURL(db, newSong.id, thumbnailURL, c.env);
      }

      return successJSend(c, { songId: newSong.id });
    } catch (error) {
      console.error("Import error:", error);
      return errorJSend(c, "Import failed", 500);
    }
  });
