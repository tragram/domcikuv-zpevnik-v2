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
  .post(
    "/autofill",
    trustedUserMiddleware,
    zValidator("json", autofillChordproSchema),
    async (c) => {
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
          instructions: `You are given a song in ChordPro format.

Your task is to complete missing chord annotations while preserving exact structure and formatting.

CHORD COMPLETION RULES
- Add chords only where lyrics already exist and chord annotations are missing.
- Treat any section that contains chords as defining a complete chord progression.
- For repeated sections (verse, chorus, bridge, etc.), reuse the chord progression
  and chord positions from the first occurrence of that section type.
- If multiple sections of the same type exist, they must have identical chord
  progressions and relative chord placements unless you are certain this is incorrect.
- If the song modulates, transpose the progression only when you are very certain.

CHORD PLACEMENT RULES (STRICT)
- Chords are aligned to syllable positions, not word boundaries.
- For a given section type, chord placements are defined by the first fully or partially
  chorded occurrence of that section.
- Reproduce the same relative syllable positions for all corresponding chords
  in every line of that section.
- If a line has the same number of syllables as its reference line, the chord placement
  MUST be identical.
- If syllable counts differ slightly, shift chords minimally to preserve rhythmic alignment.
- Never move a chord earlier or later without a syllable-based reason.

OUTPUT CONSTRAINTS
- Do not add, remove, or modify any lyrics.
- Insert chords inline only; never create chord-only lines or sections.
- Do not expand or rewrite ChordPro directives.
- Maintain original spacing, line breaks, and formatting.
- Output the complete ChordPro file only, with no commentary or abbreviations.
- If a chord or placement cannot be determined confidently, flag it for review.

EXAMPLE
\`\`\`
{start_of_verse}
[Ami]Mám [E7]v kapse jeden [Ami]frank,
jsem [G7]nejbohatší z [C]bank nad Sei[E7]nou,
mám víc než krupiér
a stíny Sacre-Coeur nade mnou.
{end_of_verse}

{start_of_chorus}
[F]Láska je [G]úděl [C]tvůj,
[Dmi]pánbůh tě [E7]opa[Ami]truj,
bonso[F]ir, mademoi[G]selle [Ami]Paris,
bonsoir, mademoiselle Paris.
{end_of_chorus}

{start_of_verse}
Znám bulvár Saint Michelle,
tam jsem včera šel s Marie-Claire,
vím, jak zní z úst krásnejch žen
slůvka "car je t'aime, oh, mon cher".
{end_of_verse}

{chorus}
\`\`\`
should be turned into
\`\`\`
{start_of_verse}
[Ami]Mám [E7]v kapse jeden [Ami]frank,
jsem [G7]nejbohatší z [C]bank nad Sei[E7]nou,
[Ami]mám [E7]víc než krupi[Ami]ér
a [G7]stíny Sacre-[C]Coeur nade [E7]mnou.
{end_of_verse}

{start_of_chorus}
[F]Láska je [G]úděl [C]tvůj,
[Dmi]pánbůh tě [E7]opa[Ami]truj,
bonso[F]ir, mademoi[G]selle [Ami]Paris,
bonso[F]ir, mademoi[G]selle [Ami]Paris.
{end_of_chorus}

{start_of_verse}
[Ami]Znám [E7]bulvár Saint Mi[Ami]chelle,
[G]tam jsem včera [C]šel s Marie-[E7]Claire,
[Ami]vím, [E7]jak zní z úst krásnejch [Ami]žen
[G]slůvka "car je [C]t'aime, oh, mon [E7]cher".
{end_of_verse}

{chorus}
\`\`\`
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
    }
  )
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
