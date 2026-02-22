import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, getTableColumns, isNotNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  song,
  SongDataDB,
  songImport,
  songVersion,
  SongVersionDB,
} from "../../../lib/db/schema";
import { failJSend, songNotFoundFail, successJSend } from "../responses";
import { buildApp } from "../utils";
import {
  findSongWithAllData,
  getSongBase,
  getSongPopulated,
  promoteVersionToCurrent,
} from "src/worker/helpers/song-helpers";
import z from "zod/v4";
import { SongDataAdminApi, SongVersionApi } from "../api-types";

const songModificationSchema = createInsertSchema(song)
  .partial()
  .omit({ id: true, updatedAt: true, createdAt: true });

// Schema for updating a version (if Admin wants to tweak it before approving)
const modifySongVersionSchema = createInsertSchema(songVersion)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    songId: true,
    userId: true,
  })
  .partial();

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
    const songs = await c.var.db
      .select({
        ...getTableColumns(song),
        ...getTableColumns(songVersion),
        id: song.id,
        externalSource: songImport
          ? {
              sourceId: songImport.sourceId,
              originalContent: songImport.originalContent,
              url: songImport.url,
            }
          : null,
      })
      .from(song)
      .where(and(isNotNull(song.currentVersionId), eq(song.hidden, false)))
      .innerJoin(songVersion, eq(song.currentVersionId, songVersion.id))
      .leftJoin(songImport, eq(songVersion.importId, songImport.id))
      .orderBy(desc(song.updatedAt));
    return successJSend(c, songs as SongDataAdminApi[]);
  })
  .get("/versions", async (c) =>
    successJSend(
      c,
      (await c.var.db
        .select()
        .from(songVersion)
        .orderBy(desc(songVersion.updatedAt))) as SongVersionDB[],
    ),
  )
  .get("/:songId", async (c) => {
    try {
      return successJSend(
        c,
        await findSongWithAllData(c.var.db, c.req.param("songId")),
      );
    } catch (e: any) {
      if (e.message === "Song not found") return songNotFoundFail(c);
      throw e;
    }
  })
  .patch("/:songId", zValidator("json", songModificationSchema), async (c) => {
    const updated = await c.var.db
      .update(song)
      .set({ ...c.req.valid("json"), updatedAt: new Date() })
      .where(eq(song.id, c.req.param("songId")))
      .returning();
    if (!updated.length) return songNotFoundFail(c);
    return successJSend(c, updated[0] as SongDataDB);
  })
  .delete("/:id", async (c) => {
    const songId = c.req.param("id");
    await getSongBase(c.var.db, songId); // throws if missing
    const deleted = await c.var.db
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
  .post("/:songId/versions/:versionId/approve", async (c) => {
    const { songId, versionId } = c.req.param();
    const db = c.var.db;

    const versionToCheck = await db
      .select()
      .from(songVersion)
      .where(and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)))
      .get();
    if (!versionToCheck) return failJSend(c, "Version not found", 404);

    await promoteVersionToCurrent(db, songId, versionId, c.var.USER!.id);
    return successJSend(c, { message: "Version approved and published." });
  })
  .post("/:songId/versions/:versionId/reject", async (c) => {
    const { songId, versionId } = c.req.param();
    const updated = await c.var.db
      .update(songVersion)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)))
      .returning();
    if (!updated.length) return failJSend(c, "Version not found", 404);
    return successJSend(c, { message: "Version rejected." });
  })
  .post("/:songId/versions/:versionId/restore", async (c) => {
    const { songId, versionId } = c.req.param();
    const db = c.var.db;

    const version = await db
      .select()
      .from(songVersion)
      .where(and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)))
      .get();
    if (!version) return failJSend(c, "Version not found", 404);
    // Logic: If it was rejected, put it back to pending (retry).
    // If it was deleted, put it to archived (safe state) or pending if you want it reviewed.
    // Defaulting to 'pending' if rejected, 'archived' if deleted.

    const newStatus = version.status === "rejected" ? "pending" : "archived";
    const updated = await db
      .update(songVersion)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(songVersion.id, versionId))
      .returning();
    return successJSend(c, updated[0] as SongVersionDB);
  })
  .patch(
    "/:songId/versions/:versionId",
    zValidator("json", modifySongVersionSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const updated = await c.var.db
        .update(songVersion)
        .set({ ...c.req.valid("json"), updatedAt: new Date() })
        .where(
          and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
        )
        .returning();
      if (!updated.length) return failJSend(c, "Version not found", 404);
      return successJSend(c, updated[0] as SongVersionApi);
    },
  )
  .delete("/:songId/versions/:versionId", async (c) => {
    const { songId, versionId } = c.req.param();
    const db = c.var.db;

    const version = await db
      .select()
      .from(songVersion)
      .where(eq(songVersion.id, versionId))
      .get();
    if (!version || version.songId !== songId)
      return failJSend(c, "Version not found", 404);

    // don't allow deletion of current version
    const songData = await getSongPopulated(db, songId);
    if (songData.currentVersionId === versionId)
      return failJSend(c, "Cannot delete active version.", 400);

    // Soft delete
    const updated = await db
      .update(songVersion)
      .set({ updatedAt: new Date(), status: "deleted" })
      .where(eq(songVersion.id, versionId))
      .returning();
    return successJSend(c, updated[0] as SongVersionDB);
  })
  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now().toString();
    await c.env.KV.put("songDB-version", newVersion);
    return successJSend(c, newVersion);
  });
