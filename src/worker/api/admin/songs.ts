import { versionNumbers } from "../../helpers/song-versions/numbering";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  findSongWithAllData,
  getSongBase,
} from "src/worker/helpers/song-helpers";
import z from "zod";
import {
  approveVersion,
  saveSongVersion,
  changeVersionStatus,
  clearOfficialVersion,
  mergeVersion,
  reclassifyVersion,
  setOfficialVersion,
} from "../../helpers/song-versions/writes";
import {
  conflict,
  curatedImportIds,
  contentOf,
  loadVersion,
  reviseVersion,
  sameContent,
  withVersionConflict,
} from "../../helpers/song-versions/revisions";
import { editorContentPatchSchema } from "src/lib/contracts/editor-schema";
import {
  illustrationPrompt,
  song,
  SongDataDB,
  songIllustration,
  songImport,
  songVersion,
  songSubmission,
  user,
} from "../../../lib/db/schema";
import {
  SongDataAdminApi,
  SongVersionAdminApi,
  SongVersionApi,
} from "../api-types";
import {
  failJSend,
  songNotFoundFail,
  successJSend,
  zValidatorJSend,
} from "../responses";
import { buildApp } from "../utils";

const songModificationSchema = createInsertSchema(song)
  .partial()
  .omit({ id: true, updatedAt: true, createdAt: true, currentVersionId: true });

// Schema for updating a version (if Admin wants to tweak it before approving)
const modifySongVersionSchema = editorContentPatchSchema.extend({
  expectedRevision: z.number().int().positive(),
});
const versionStateSchema = z.object({
  expectedRevision: z.number().int().positive(),
});
const approvalSchema = versionStateSchema.extend({
  makeOfficial: z.boolean().optional(),
  archivePrevious: z.boolean().optional(),
  expectedTargetRevision: z.number().int().positive().optional(),
  expectedOfficialId: z.string().nullable().optional(),
  force: z.boolean().optional(),
});

export type SongModificationSchema = z.infer<typeof songModificationSchema>;
export type ModifySongVersionSchema = z.infer<typeof modifySongVersionSchema>;

export const songRoutes = buildApp()
  .get("/", async (c) =>
    successJSend(
      c,
      (await c.var.db
        .select()
        .from(song)
        .orderBy(desc(song.createdAt))) as SongDataDB[],
    ),
  )
  .get("/withCurrentVersion", async (c) => {
    const records = await c.var.db
      .select({
        ...getTableColumns(song),
        ...getTableColumns(songVersion),
        id: song.id,
        officialVersionId: song.currentVersionId,
        importSourceId: songImport.sourceId,
        importOriginalContent: songImport.originalContent,
        importUrl: songImport.url,
      })
      .from(song)
      .innerJoin(songVersion, eq(song.currentVersionId, songVersion.id))
      .leftJoin(songImport, eq(songVersion.importId, songImport.id))
      .orderBy(desc(song.updatedAt));

    const curated = await curatedImportIds(c.var.db, records.flatMap((row) => row.officialVersionId
      ? [{ ...row, id: row.officialVersionId }]
      : []));
    const songs = records.map((record) => {
      // Destructure the import fields out of the record
      const { importSourceId, importOriginalContent, importUrl, ...rest } =
        record;

      // Construct and return the typed object
      return {
        ...rest,
        externalSource: importSourceId && !curated.has(record.officialVersionId ?? "")
          ? {
              sourceId: importSourceId,
              originalContent: importOriginalContent!,
              url: importUrl!,
            }
          : null,
      } as SongDataAdminApi;
    });

    return successJSend(c, songs);
  })
  .get("/versions", async (c) => {
    const records = await c.var.db
      .select({
        ...getTableColumns(songVersion),
        ...getTableColumns(songSubmission),
        officialVersionId: song.currentVersionId,
        authorName: user.name,
        authorNickname: user.nickname,
        importSourceId: songImport.sourceId,
        importUrl: songImport.url,
      })
      .from(songVersion)
      .innerJoin(user, eq(user.id, songVersion.userId))
      .leftJoin(song, eq(song.id, songVersion.songId))
      .leftJoin(songSubmission, eq(songSubmission.versionId, songVersion.id))
      .leftJoin(songImport, eq(songVersion.importId, songImport.id))
      .orderBy(desc(songVersion.updatedAt));
    const [numbers, curated] = await Promise.all([
      versionNumbers(c.var.db),
      curatedImportIds(c.var.db, records),
    ]);
    return successJSend(c, records.map(({ officialVersionId, authorName, authorNickname, ...row }) => ({
      ...row,
      importSourceId: curated.has(row.id) ? null : row.importSourceId,
      importUrl: curated.has(row.id) ? null : row.importUrl,
      authorName: authorNickname || authorName,
      isOfficial: row.id === officialVersionId,
      versionNumber: numbers.get(row.id),
    })) as SongVersionAdminApi[]);
  })
  .get("/:songId", async (c) => {
    try {
      return successJSend(
        c,
        await findSongWithAllData(c.var.db, c.req.param("songId")),
      );
    } catch {
      return songNotFoundFail(c);
    }
  })
  .patch(
    "/:songId",
    zValidatorJSend("json", songModificationSchema),
    async (c) => {
      const updated = await c.var.db
        .update(song)
        .set({ ...c.req.valid("json"), updatedAt: new Date() })
        .where(eq(song.id, c.req.param("songId")))
        .returning();
      if (!updated.length) return songNotFoundFail(c);
      return successJSend(c, updated[0] as SongDataDB);
    },
  )
  .delete("/:id", async (c) => {
    const songId = c.req.param("id");
    const db = c.var.db;
    await getSongBase(db, songId); // throws if missing

    // shadow delete all related illustrations & prompts
    await db
      .update(songIllustration)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(songIllustration.songId, songId));
    await db
      .update(illustrationPrompt)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(illustrationPrompt.songId, songId));

    const deleted = await db
      .update(song)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(song.id, songId))
      .returning();
    return successJSend(c, deleted[0] as SongDataDB);
  })
  .post("/:id/restore", async (c) => {
    const songId = c.req.param("id");
    await getSongBase(c.var.db, songId); // throws if missing
    const restored = await c.var.db
      .update(song)
      .set({ deleted: false, updatedAt: new Date() })
      .where(eq(song.id, songId))
      .returning();
    return successJSend(c, restored[0] as SongDataDB);
  })
  .post(
    "/:songId/versions/:versionId/approve",
    zValidatorJSend("json", approvalSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      return successJSend(
        c,
        await approveVersion(
          c.var.db,
          songId,
          versionId,
          c.var.USER!.id,
          c.req.valid("json"),
        ),
      );
    },
  )
  .post(
    "/:songId/versions/:versionId/official",
    zValidatorJSend("json", versionStateSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      return successJSend(
        c,
        await setOfficialVersion(
          c.var.db,
          songId,
          versionId,
          c.var.USER!.id,
          c.req.valid("json").expectedRevision,
        ),
      );
    },
  )
  .delete(
    "/:songId/versions/:versionId/official",
    zValidatorJSend("json", versionStateSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      return successJSend(c, await clearOfficialVersion(c.var.db, songId, versionId, c.var.USER!.id, c.req.valid("json").expectedRevision));
    },
  )
  .post(
    "/:songId/versions/:versionId/merge",
    zValidatorJSend(
      "json",
      versionStateSchema.extend({
        targetVersionId: z.string(),
        expectedTargetRevision: z.number().int().positive(),
      }),
    ),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const input = c.req.valid("json");
      return successJSend(
        c,
        await mergeVersion(
          c.var.db,
          songId,
          versionId,
          input.targetVersionId,
          c.var.USER!.id,
          input.expectedRevision,
          input.expectedTargetRevision,
        ),
      );
    },
  )
  .post(
    "/:songId/versions/:versionId/reclassify",
    zValidatorJSend("json", versionStateSchema.extend({ expectedParentRevision: z.number().int().positive() })),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const { expectedRevision, expectedParentRevision } = c.req.valid("json");
      return successJSend(c, await reclassifyVersion(c.var.db, songId, versionId,
        c.var.USER!.id, expectedRevision, expectedParentRevision));
    },
  )
  .post(
    "/:songId/versions/:versionId/:action",
    zValidatorJSend("json", versionStateSchema.extend({ fallbackStatus: z.enum(["published", "archived", "pending"]).optional() })),
    async (c) => {
      const { songId, versionId, action } = c.req.param();
      if (action !== "archive" && action !== "restore" && action !== "reject")
        return failJSend(c, "Unknown action", 404);
      return successJSend(
        c,
        await changeVersionStatus(
          c.var.db,
          songId,
          versionId,
          c.var.USER!.id,
          action,
          c.req.valid("json").expectedRevision,
          c.req.valid("json").fallbackStatus,
        ),
      );
    },
  )
  .patch(
    "/:songId/versions/:versionId/author",
    zValidatorJSend("json", versionStateSchema.extend({ userId: z.string().min(1) })),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const { expectedRevision, userId } = c.req.valid("json");
      const db = c.var.db;
      const [base, author] = await Promise.all([
        loadVersion(db, songId, versionId),
        db.query.user.findFirst({ where: eq(user.id, userId), columns: { id: true } }),
      ]);
      if (base.revision !== expectedRevision) throw conflict();
      if (base.mergedIntoVersionId || base.status === "deleted")
        return failJSend(c, "This version is closed", 400);
      if (!author) return failJSend(c, "Author not found", 404);
      if (base.userId === userId) return successJSend(c, base);
      await withVersionConflict(() => db.batch([
        reviseVersion(db, base, { userId }, c.var.USER!.id),
        db.update(song).set({ updatedAt: new Date() }).where(eq(song.id, songId)),
      ]));
      return successJSend(c, await loadVersion(db, songId, versionId));
    },
  )
  .patch(
    "/:songId/versions/:versionId",
    zValidatorJSend("json", modifySongVersionSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const { expectedRevision, ...changes } = c.req.valid("json");
      const base = await loadVersion(c.var.db, songId, versionId);
      if (base.revision !== expectedRevision) throw conflict();
      if (base.mergedIntoVersionId || base.status === "deleted")
        return failJSend(c, "This version is closed", 400);
      if (sameContent(base, { ...base, ...changes }))
        return successJSend(c, base as SongVersionApi);
      // A display name change uses the same version, including for imported sheets.
      const labelOnly = changes.label !== undefined && Object.keys(changes).length === 1;
      if (base.importId && !labelOnly) return successJSend(c, await saveSongVersion(c.var.db, { ...contentOf(base), ...changes, baseVersionId: base.id, expectedRevision }, songId, c.var.USER!.id));
      await withVersionConflict(() =>
        c.var.db.batch([
          reviseVersion(c.var.db, base, changes, c.var.USER!.id),
          c.var.db
            .update(song)
            .set({ updatedAt: new Date() })
            .where(eq(song.id, songId)),
        ]),
      );
      return successJSend(
        c,
        (await loadVersion(c.var.db, songId, versionId)) as SongVersionApi,
      );
    },
  )
  .delete(
    "/:songId/versions/:versionId",
    zValidatorJSend("json", versionStateSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      return successJSend(
        c,
        await changeVersionStatus(
          c.var.db,
          songId,
          versionId,
          c.var.USER!.id,
          "delete",
          c.req.valid("json").expectedRevision,
        ),
      );
    },
  )
  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now().toString();
    await c.env.KV.put("songDB-version", newVersion);
    return successJSend(c, newVersion);
  });
