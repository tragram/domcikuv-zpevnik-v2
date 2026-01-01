import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { user } from "../../lib/db/schema";

import { eq } from "drizzle-orm";
import { buildApp } from "./utils";
import { zValidator } from "@hono/zod-validator";
import {
  createSong,
  createSongVersion,
  deleteSongVersion,
  findSong,
  getSongVersionsByUser,
} from "../services/song-service";
import { errorJSend, failJSend, successJSend } from "./responses";
import OpenAI from "openai";
import { trustedUserMiddleware } from "./utils";

export const editorSubmitSchema = z.object({
  title: z.string(),
  artist: z.string(),
  language: z.string(),
  chordpro: z.string(),
  key: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  capo: z
    .number()
    .optional()
    .transform((x) => x ?? null),
  range: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  startMelody: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  tempo: z
    .union([z.string(), z.number()])
    .optional()
    .transform((x) => (x ? String(x) : null)),
});

export const autofillChordproSchema = z.object({
  chordpro: z.string(),
});

export type EditorSubmitSchema = z.infer<typeof editorSubmitSchema>;
export type EditorSubmitSchemaInput = z.input<typeof editorSubmitSchema>;

const editorApp = buildApp()
  .post("/autofill", 
    zValidator("json", autofillChordproSchema), async (c) => {
    const { chordpro } = c.req.valid("json");

    const apiKey = c.env.OPENAI_API_KEY;
    if (!apiKey) {
      return errorJSend(
        c,
        "Server configuration error",
        500,
        "MISSING_API_KEY"
      );
    }

    try {
      const client = new OpenAI({ apiKey });

      const response = await client.responses.create({
        model: "gpt-5.2",
        text: {
          format: {
            type: "text",
          },
          verbosity: "low",
        },
        reasoning: {
          effort: "none",
          summary: null,
        },
        instructions: `
        Given a song in ChordPro format with repeated sections missing chords, complete the chords as follows:
          - Add chords only where lyrics already exist and chord annotations are missing.
          - For repeated sections (verse, chorus, bridge, etc.), copy the chord progression from the first occurrence of that section.
          - If a section contains partial chords (e.g. when there are four lines in a verse with only the first two containing chords), fill in the missing ones when reasonably certain.
          - Preserve all existing ChordPro directives and structure exactly.
          - If the song modulates, transpose chords to preserve the relative progression. Only do this when very certain that a modulation has happened.

          Output rules:
          - Do not add, remove, or modify any lyrics.
          - Insert chords inline with the lyrics; do not add separate chord-only sections.
          - Align chords correctly with syllables - there will typically be the same number of syllables between the chords in the same section type.
          - Always insert chords at syllable bounds. Weakly prefer putting them at the start of the words, unless the syllable counts make it likely they should be within a word. Keep in mind that a chord being at the start of a word in one verse does not necessarily imply it will be the same in the next one - the number of syllables is key, not always word bounds.
          - Do not expand or rewrite section directives.
          - Maintain original formatting.
          - Output the complete ChordPro file only—no commentary or abbreviations.
          - If uncertain about a chord, flag it for review.
          - If a section has no clear reference progression, leave it unchanged and flag it for review.
        `,
        input: chordpro,
      });

      const filledChordpro = response.output_text;

      if (!filledChordpro) {
        return errorJSend(
          c,
          "AI returned empty response",
          500,
          "AI_EMPTY_RESPONSE"
        );
      }

      return successJSend(c, { chordpro: filledChordpro });
    } catch (error) {
      console.error(error);
      return errorJSend(
        c,
        "Internal server error during autofill",
        500,
        "AUTOFILL_ERROR"
      );
    }
  })
  // --- Existing Endpoints ---
  .post("/", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;
    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;
      const result = await createSong(db, submission, userId, isTrusted);
      return successJSend(c, {
        song: result.newSong,
        version: result.newVersion,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return errorJSend(c, error.message, 400, "SONG_CREATION_FAILED");
      }
      return errorJSend(c, "Failed to add song", 500, "ADD_SONG_ERROR");
    }
  })
  .put("/:id", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;
    const songId = c.req.param("id");

    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;

      // ensure a song with the same id exists...
      const existingSong = await findSong(db, songId, false);

      const versionResult = await createSongVersion(
        db,
        submission,
        songId,
        userId,
        isTrusted
      );

      return successJSend(c, { song: existingSong, version: versionResult });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return failJSend(c, error.message, 400, "VERSION_EXISTS");
      }
      return errorJSend(c, "Failed to add song version", 500, "UPDATE_ERROR");
    }
  })
  .get("/submissions", async (c) => {
    const userId = c.get("USER")?.id;
    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const versions = await getSongVersionsByUser(db, userId);
      return successJSend(c, versions);
    } catch (error) {
      console.error(error);
      return errorJSend(
        c,
        "Failed to retrieve your submissions",
        500,
        "GET_EDITS_ERROR"
      );
    }
  })
  .delete("/:id", async (c) => {
    const userId = c.get("USER")?.id;
    const versionId = c.req.param("id");

    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      await deleteSongVersion(db, versionId, userId);
      return successJSend(c, { message: "Version deleted successfully" });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return errorJSend(c, error.message, 400, "DELETE_VERSION_FAILED");
      }
      return errorJSend(
        c,
        "Failed to delete version",
        500,
        "DELETE_VERSION_ERROR"
      );
    }
  });

export default editorApp;
