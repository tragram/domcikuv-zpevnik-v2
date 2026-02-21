import { zValidator } from "@hono/zod-validator";
import { ChordProParser } from "chordproject-parser";
import { drizzle } from "drizzle-orm/d1";
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
  findSong,
  SongWithCurrentVersion,
} from "../helpers/song-helpers";
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
      const results = await searchAllExternalServices(query, c.env);
      return successJSend(c, results);
    } catch (error) {
      console.error("External search failed:", error);
      return errorJSend(c, "Failed to fetch external songs", 500);
    }
  })
  .post(
    "/import",
    zValidator("json", externalSearchResultSchema),
    async (c) => {
      const { title, artist, url, sourceId, thumbnailURL } =
        c.req.valid("json");
      const db = drizzle(c.env.DB);
      const user = c.get("USER");

      if (!user)
        return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

      try {
        // Check if the song (by artist/title ID) already exists in the internal DB (allow multiple external versions)
        const newSongId = SongData.baseId(title, artist);
        let existingSong = null;
        try {
          existingSong = (await findSong(
            db,
            newSongId,
            true,
          )) as SongWithCurrentVersion;
          if (!existingSong.externalSource) {
            // song not only exists but is already an internal song - do not add, just redirect to the actual song
            return successJSend(c, { songId: existingSong.id });
          }
        } catch {}

        // Fetch the source page
        const response = await fetch(url);
        if (!response.ok) return errorJSend(c, "Source fetch failed", 502);

        let unparsedLyrics = "";

        // Source-specific scraping (only for lyrics!)
        const rewriter = new HTMLRewriter();
        if (sourceId === "zpevnik-skorepova") {
          // Extract the original ID that we stored during the search mapping
          const originalId = c.req
            .valid("json")
            .id.replace("zpevnik-skorepova/", "");

          // Pull the cached array from KV
          const cachedSongs = (await c.env.KV.get(
            "zpevnik_skorepova_all_songs",
            "json",
          )) as any[];
          console.log(originalId)
          const song = cachedSongs?.find((s: any) => s.id === originalId);

          if (!song || !song.data.text) {
            return failJSend(
              c,
              "Song data not found in cache",
              404,
              "IMPORT_ERROR",
            );
          }

          // Zpevnik Skorepova already provides the raw text/chordpro format directly
          unparsedLyrics = song.data.text;
        } else if (sourceId === "pisnicky-akordy") {
          rewriter.on("div#songtext pre", {
            text(text) {
              unparsedLyrics += text.text;
            },
          });
        } else if (sourceId === "cifraclub") {
          // Example selector for CifraClub, adjust to match their DOM
          rewriter.on("pre", {
            text(text) {
              unparsedLyrics += text.text;
            },
          });
        } else {
          return failJSend(c, "Unsupported external source", 400);
        }

        await rewriter.transform(response).text();

        if (!unparsedLyrics)
          return failJSend(
            c,
            "Error scraping song lyrics",
            500,
            "IMPORT_ERROR",
          );

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
        if (!existingSong) {
          ({ newSong: existingSong } = await createSong(
            db,
            submission,
            user.id,
            true,
            importedSong.id,
          ));
        } else {
          const newVersion = await createSongVersion(
            db,
            submission,
            existingSong.id,
            user.id,
            true,
            importedSong.id,
          );
        }
        if (thumbnailURL) {
          try {
            await addIllustrationFromURL(
              db,
              existingSong.id,
              sourceId,
              thumbnailURL,
              c.env,
            );
          } catch {}
        }

        return successJSend(c, { songId: existingSong.id });
      } catch (error) {
        console.error("Import error:", error);
        return errorJSend(c, "Import failed", 500);
      }
    },
  );
