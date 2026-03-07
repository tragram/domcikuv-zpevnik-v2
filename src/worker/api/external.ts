import { ChordProParser } from "chordproject-parser";
import { convertToChordPro } from "~/lib/chords2chordpro";
import { guessLanguage } from "~/lib/utils";
import { SongData } from "~/types/songData";
import {
  externalSearchResultSchema,
  searchAllExternalServices,
} from "../helpers/external-search";
import { addIllustrationFromURL } from "../helpers/illustration-helpers";
import {
  createImportSong,
  createSong,
  createSongVersion,
  retrieveSingleSong,
} from "../helpers/song-helpers";
import { EditorSubmitSchema } from "./editor";
import {
  errorJSend,
  failJSend,
  successJSend,
  zValidatorJSend,
} from "./responses";
import { buildApp } from "./utils";
import { SongDataApi } from "./api-types";
import {
  SkorepovaCache,
  ZPEVNIK_SKOREPOVA_CACHE_KEY,
} from "../helpers/external-search/zpevnik-skorepova";
import { eq } from "drizzle-orm";
import { song } from "src/lib/db/schema";

export const externalRoutes = buildApp()
  .get("/search", async (c) => {
    const query = c.req.query("q");
    const user = c.var.USER;

    if (!user)
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    if (!query || query.trim().length < 3) return successJSend(c, []);

    const results = await searchAllExternalServices(query, c.env);
    return successJSend(c, results);
  })
  .post(
    "/import",
    zValidatorJSend("json", externalSearchResultSchema),
    async (c) => {
      const { title, artist, url, sourceId, thumbnailURL } =
        c.req.valid("json");
      const db = c.var.db;
      const user = c.var.USER;

      if (!user)
        return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

      // Check if the song (by artist/title ID) already exists in the internal DB (allow multiple external versions)
      const newSongId = SongData.baseId(title, artist);

      let existingSong: SongDataApi | null = null;

      try {
        existingSong = await retrieveSingleSong(db, newSongId);
        if (existingSong && !existingSong.externalSource) {
          // TODO: restore if deleted
          // song not only exists but is already an internal song - do not add, just redirect to the actual song
          return successJSend(c, { songId: existingSong.id });
        }
      } catch {
        // Song doesn't exist yet, proceed
      }

      const response = await fetch(url);
      if (!response.ok) return errorJSend(c, "Source fetch failed", 502);

      let unparsedLyrics = "";
      const rewriter = new HTMLRewriter();

      if (sourceId === "zpevnik-skorepova") {
        const originalId = c.req
          .valid("json")
          .id.replace("zpevnik-skorepova/", "");
        const cachedSongs = (await c.env.KV.get(
          ZPEVNIK_SKOREPOVA_CACHE_KEY,
          "json",
        )) as SkorepovaCache;
        const song = cachedSongs?.songs.find((s) => s.id === originalId);
        if (!song || !song.data.text) {
          return failJSend(
            c,
            "Song data not found in cache",
            404,
            "IMPORT_ERROR",
          );
        }
        unparsedLyrics = song.data.text;
      } else if (sourceId === "pisnicky-akordy") {
        rewriter.on("div#songtext pre", {
          text(text) {
            unparsedLyrics += text.text;
          },
        });
      } else if (sourceId === "cifraclub") {
        rewriter.on("pre", {
          text(text) {
            unparsedLyrics += text.text;
          },
        });
      } else {
        return failJSend(c, "Unsupported external source", 400);
      }

      await rewriter.transform(response).text();

      if (!unparsedLyrics) {
        return failJSend(c, "Error scraping song lyrics", 500, "IMPORT_ERROR");
      }

      const chordPro = convertToChordPro(
        unparsedLyrics,
        // non-czech sources need to have chords converted
        ["cifraclub"].includes(sourceId),
      );
      const importedSong = await createImportSong(
        db,
        title,
        artist,
        unparsedLyrics,
        url,
        user.id,
        sourceId,
      );

      const submission: EditorSubmitSchema = {
        title,
        artist,
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

      if (!existingSong) {
        await createSong(db, submission, user.id, true, importedSong.id);
        existingSong = await retrieveSingleSong(db, newSongId);
      } else {
        await createSongVersion(
          db,
          submission,
          existingSong.id,
          user.id,
          true,
          importedSong.id,
        );
      }

      if (!existingSong) throw Error("Failed to create song!");

      if (thumbnailURL) {
        try {
          await addIllustrationFromURL(
            db,
            existingSong.id,
            sourceId,
            thumbnailURL,
            c.env,
          );
        } catch {
          // Non-fatal, continue
        }
      }

      return successJSend(c, { songId: existingSong.id });
    },
  );
