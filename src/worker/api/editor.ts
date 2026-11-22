import { songVersion, SongVersionDB } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { approveVersion, changeVersionStatus, setOfficialVersion } from "../helpers/song-versions/writes";
import { retrieveRevisions, restoreRevision } from "../helpers/song-versions/revisions";
import { buildApp } from "./utils";

import {
  createSong,
  createSongVersion,
  getSongBase,
  getSongVersionsByUser,
} from "../helpers/song-helpers";
import { failJSend, successJSend, zValidatorJSend } from "./responses";
import OpenAI from "openai";
import { trustedUserMiddleware } from "./utils";
import { EditorSubmissionResponse } from "./api-types";
import { setSongbookEntry } from "../helpers/favorite-helpers";
import {
  autofillChordproSchema,
  editorSubmitSchema,
  editorUpdateSchema,
} from "src/lib/contracts/editor-schema";

const editorApp = buildApp()
  .post(
    "/autofill",
    trustedUserMiddleware,
    zValidatorJSend("json", autofillChordproSchema),
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
        model: "gpt-5.6-terra",
        service_tier: "flex",
        text: {
          format: { type: "text" },
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
  .post("/", zValidatorJSend("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.var.USER?.id;

    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const db = c.var.db;
    const result = await createSong(db, submission, userId);
    try {
      // Pin the author's songbook to their new version so it shows for them
      // regardless of approval status (also adds it to their favorites).
      await setSongbookEntry(db, userId, result.newSong.id, {
        pinnedVersionId: result.newVersion.id,
      });
    } catch {
      /* non fatal */
    }
    return successJSend(c, {
      song: result.newSong,
      version: result.newVersion,
    } as EditorSubmissionResponse);
  })
  .put("/:id", zValidatorJSend("json", editorUpdateSchema), async (c) => {
    const { editAsPreviousAuthor, editAsSubmitter, addToFavorites, publish, ...submission } = c.req.valid("json");
    const userId = c.var.USER?.id;
    const songId = c.req.param("id");

    if (!userId) {
      return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }

    const db = c.var.db;

    const existingSong = await getSongBase(db, songId);

    const versionResult = await createSongVersion(
      db,
      submission,
      songId,
      userId,
      undefined,
      { editAsPreviousAuthor, editAsSubmitter, publish },
    );

    const switchedVersion = versionResult.id !== (submission.baseVersionId ?? submission.parentId);
    const ownsVersion = versionResult.userId === userId;
    const legacyPin = switchedVersion && ownsVersion;
    if (addToFavorites ?? legacyPin) {
      // Pin separately selectable versions and the editor's own pending drafts.
      // A revision to an existing sheet preserves the editor's current pin.
      const pin = addToFavorites === undefined ? legacyPin
        : (submission.saveMode === "new-version" && versionResult.status === "published")
          || (ownsVersion && versionResult.status === "pending");
      try {
        await setSongbookEntry(db, userId, existingSong.id, pin ? { pinnedVersionId: versionResult.id } : {});
      } catch {
        /* non fatal */
      }
    }

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
  .get("/:songId/versions/:versionId/revisions", zValidatorJSend("query", z.object({ offset: z.coerce.number().int().min(0).default(0) })), async (c) => {
    if (!c.var.USER) return failJSend(c, "Authentication required", 401);
    const { songId, versionId } = c.req.param();
    return successJSend(c, await retrieveRevisions(c.var.db, songId, versionId, c.var.USER.id, c.req.valid("query").offset));
  })
  .post("/:songId/versions/:versionId/revisions/:number/restore", zValidatorJSend("json", z.object({ expectedRevision: z.number().int().positive() })), async (c) => {
    if (!c.var.USER) return failJSend(c, "Authentication required", 401);
    const { songId, versionId, number } = c.req.param();
    const revision = z.coerce.number().int().positive().parse(number);
    return successJSend(c, await restoreRevision(c.var.db, songId, versionId, revision, c.req.valid("json").expectedRevision, c.var.USER.id));
  })
  .post("/:songId/versions/:versionId/:action", zValidatorJSend("json", z.object({ expectedRevision: z.number().int().positive() })), async (c) => {
    if (!c.var.USER) return failJSend(c, "Authentication required", 401);
    const { songId, versionId, action } = c.req.param();
    const expected = c.req.valid("json").expectedRevision;
    if (action === "official") return successJSend(c, await setOfficialVersion(c.var.db, songId, versionId, c.var.USER.id, expected));
    if (action === "publish") return successJSend(c, await approveVersion(c.var.db, songId, versionId, c.var.USER.id, { expectedRevision: expected }));
    if (action !== "archive" && action !== "restore") return failJSend(c, "Unknown action", 404);
    return successJSend(c, await changeVersionStatus(c.var.db, songId, versionId, c.var.USER.id, action, expected));
  })
  .delete("/versions/:id", zValidatorJSend("json", z.object({ expectedRevision: z.number().int().positive() })), async (c) => {
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

    await changeVersionStatus(db, version.songId, versionId, userId, "delete", c.req.valid("json").expectedRevision);

    return successJSend(c, { message: "Version deleted successfully" });
  });

export default editorApp;
