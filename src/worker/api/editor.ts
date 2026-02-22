import { z } from "zod";
import { songVersion, SongVersionDB, user } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { buildApp } from "./utils";
import { zValidator } from "@hono/zod-validator";
import {
  createSong,
  createSongVersion,
  getSongBase,
  getSongPopulated,
  getSongVersionsByUser,
} from "../helpers/song-helpers";
import { failJSend, successJSend } from "./responses";
import OpenAI from "openai";
import { trustedUserMiddleware } from "./utils";
import { EditorSubmissionResponse } from "./api-types";

export const editorSubmitSchema = z.object({
  title: z.string(),
  artist: z.string(),
  language: z.string(),
  chordpro: z.string(),
  parentId: z.string().optional(),
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
        return failJSend(
          c,
          "Server configuration error",
          500,
          "MISSING_API_KEY",
        );
      }

      const client = new OpenAI({ apiKey });

      const response = await client.responses.create({
        model: "gpt-5.2",
        text: { format: { type: "text" }, verbosity: "low" },
        reasoning: { effort: "none", summary: null },
        // ... Original long instructions omitted for brevity, keep the exact same string you had ...
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
        return failJSend(
          c,
          "AI returned empty response",
          500,
          "AI_EMPTY_RESPONSE",
        );
      }

      return successJSend(c, { chordpro: filledChordpro });
    },
  )
  .post("/", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.var.USER?.id;

    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const db = c.var.db;
    const userProfile = await db
      .select({ isTrusted: user.isTrusted })
      .from(user)
      .where(eq(user.id, userId))
      .get();

    const isTrusted = !!userProfile?.isTrusted;
    const result = await createSong(db, submission, userId, isTrusted);

    return successJSend(c, {
      song: result.newSong,
      version: result.newVersion,
    } as EditorSubmissionResponse);
  })
  .put("/:id", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.var.USER?.id;
    const songId = c.req.param("id");

    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const db = c.var.db;
    const userProfile = await db
      .select({ isTrusted: user.isTrusted })
      .from(user)
      .where(eq(user.id, userId))
      .get();

    const isTrusted = !!userProfile?.isTrusted;

    // getSongPopulated will throw an error if the song is not found.
    // The global handler catches it and returns a clean 500 or mapped 404 depending on your helper logic.
    const existingSong = await getSongBase(db, songId);

    const versionResult = await createSongVersion(
      db,
      submission,
      songId,
      userId,
      isTrusted,
    );

    // Response includes status so UI can show "Changes saved (Pending Approval)"
    return successJSend(c, {
      song: existingSong,
      version: versionResult,
      status: versionResult.status,
    } as EditorSubmissionResponse);
  })
  .get("/submissions", async (c) => {
    const userId = c.var.USER?.id;
    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const versions = await getSongVersionsByUser(c.var.db, userId);
    return successJSend(c, versions as SongVersionDB[]);
  })
  .delete("/versions/:id", async (c) => {
    const userId = c.var.USER?.id;
    const versionId = c.req.param("id");

    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const db = c.var.db;
    const version = await db
      .select()
      .from(songVersion)
      .where(eq(songVersion.id, versionId))
      .get();

    if (!version) {
      return failJSend(c, "Version not found", 404, "VERSION_NOT_FOUND");
    }

    if (version.userId !== userId || version.status !== "pending") {
      return failJSend(
        c,
        "Users can only delete their own pending song versions",
        403,
        "INSUFFICIENT_PRIVILEGES",
      );
    }

    await db
      .update(songVersion)
      .set({
        updatedAt: new Date(),
        status: "deleted",
      })
      .where(eq(songVersion.id, versionId))
      .returning();

    return successJSend(c, { message: "Version deleted successfully" });
  });

export default editorApp;
