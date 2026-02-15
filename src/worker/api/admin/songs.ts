import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, getTableColumns, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createInsertSchema } from "drizzle-zod";
import z from "zod/v4";
import {
  song,
  SongDataDB,
  songVersion,
  SongVersionDB,
} from "../../../lib/db/schema";
import {
  findSong,
  findSongWithAllData,
  promoteVersionToCurrent,
  SongWithCurrentVersion,
} from "../../helpers/song-helpers";
import {
  errorJSend,
  failJSend,
  songNotFoundFail,
  successJSend,
} from "../responses";
import { buildApp } from "../utils";

// Song validation schemas
const songModificationSchema = createInsertSchema(song)
  .partial()
  .omit({ id: true, updatedAt: true, createdAt: true });

// Schema for updating a version (if Admin wants to tweak it before approving)
const modifySongVersionSchema = createInsertSchema(songVersion)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    songId: true, // Should not move versions between songs
    userId: true, // Should not change author
  })
  .partial();

export type SongModificationSchema = z.infer<typeof songModificationSchema>;
export type ModifySongVersionSchema = z.infer<typeof modifySongVersionSchema>;

export const songRoutes = buildApp()
  .get("/", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs: SongDataDB[] = await db
        .select()
        .from(song)
        .orderBy(desc(song.createdAt));
      return successJSend(c, songs);
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to fetch songs", 500, "INTERNAL_ERROR");
    }
  })
  .get("/withCurrentVersion", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs: SongWithCurrentVersion[] = await db
        .select({
          ...getTableColumns(song),
          ...getTableColumns(songVersion),
          id: song.id,
        })
        .from(song)
        .where(and(isNotNull(song.currentVersionId), eq(song.hidden, false)))
        .innerJoin(songVersion, eq(song.currentVersionId, songVersion.id))
        .orderBy(desc(song.updatedAt));

      return successJSend(c, {
        songs,
        count: songs.length,
      });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return errorJSend(c, "Failed to fetch songs", 500, "FETCH_ERROR");
    }
  })

  .get("/versions", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const versions: SongVersionDB[] = await db
        .select()
        .from(songVersion)
        .orderBy(desc(songVersion.updatedAt));

      return successJSend(c, versions);
    } catch (error) {
      console.error("Error fetching songs:", error);
      return errorJSend(c, "Failed to fetch songs", 500, "FETCH_ERROR");
    }
  })
  .get("/:songId", async (c) => {
    const songId = c.req.param("songId");
    const db = drizzle(c.env.DB);
    try {
      const songData = await findSongWithAllData(db, songId);
      return successJSend(c, songData);
    } catch (error) {
      if (error instanceof Error && error.message === "Song not found") {
        return songNotFoundFail(c);
      }
      return errorJSend(c, "Failed to fetch song", 500, "INTERNAL_ERROR");
    }
  })

  // --- Existing Patch Song Metadata ---
  .patch("/:songId", zValidator("json", songModificationSchema), async (c) => {
    const songId = c.req.param("songId");
    const data = c.req.valid("json");
    const db = drizzle(c.env.DB);

    try {
      const updated = await db
        .update(song)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(song.id, songId))
        .returning();
      return successJSend(c, updated[0]);
    } catch (error) {
      console.error(error);
      return songNotFoundFail(c);
    }
  })

  .delete("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const songId = c.req.param("id");
    try {
      await findSong(db, songId);
      const deletedSong = await db
        .update(song)
        .set({ deleted: true, updatedAt: new Date() })
        .where(eq(song.id, songId))
        .returning();
      return successJSend(c, deletedSong[0]);
    } catch (error) {
      console.error(error);
      return songNotFoundFail(c);
    }
  })

  .post("/:id/restore", async (c) => {
    const db = drizzle(c.env.DB);
    const songId = c.req.param("id");
    try {
      await findSong(db, songId, false);
      const restoredSong = await db
        .update(song)
        .set({ deleted: false, updatedAt: new Date() })
        .where(eq(song.id, songId))
        .returning();
      return successJSend(c, restoredSong[0]);
    } catch (error) {
      console.error(error);
      return songNotFoundFail(c);
    }
  })

  .post("/:songId/versions/:versionId/approve", async (c) => {
    const { songId, versionId } = c.req.param();
    // TODO: silence this error - given the admin guards, a USER not having been set is a security risk (but it should be under current structure)
    const adminId = c.get("USER").id;
    const db = drizzle(c.env.DB);

    try {
      // Validate existence first
      const versionToCheck = await db
        .select()
        .from(songVersion)
        .where(
          and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
        )
        .get();

      if (!versionToCheck) {
        return failJSend(c, "Version not found", 404, "VERSION_NOT_FOUND");
      }

      await promoteVersionToCurrent(db, songId, versionId, adminId);

      return successJSend(c, { message: "Version approved and published." });
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to approve version", 500, "APPROVE_ERROR");
    }
  })

  .post("/:songId/versions/:versionId/reject", async (c) => {
    const { songId, versionId } = c.req.param();
    const db = drizzle(c.env.DB);

    try {
      // We don't delete it, we just mark status as rejected so the user sees it
      const updated = await db
        .update(songVersion)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(
          and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
        )
        .returning();

      if (!updated.length) {
        return failJSend(c, "Version not found", 404, "VERSION_NOT_FOUND");
      }

      return successJSend(c, { message: "Version rejected." });
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to reject version", 500, "REJECT_ERROR");
    }
  })

  .post("/:songId/versions/:versionId/restore", async (c) => {
    const { songId, versionId } = c.req.param();
    const db = drizzle(c.env.DB);

    try {
      const version = await db
        .select()
        .from(songVersion)
        .where(
          and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
        )
        .get();

      if (!version) {
        return failJSend(c, "Version not found", 404, "VERSION_NOT_FOUND");
      }

      // Logic: If it was rejected, put it back to pending (retry).
      // If it was deleted, put it to archived (safe state) or pending if you want it reviewed.
      // Defaulting to 'pending' if rejected, 'archived' if deleted.
      const newStatus = version.status === "rejected" ? "pending" : "archived";

      const updated = await db
        .update(songVersion)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(songVersion.id, versionId))
        .returning();

      return successJSend(c, updated[0]);
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to restore version", 500, "RESTORE_ERROR");
    }
  })

  .patch(
    "/:songId/versions/:versionId",
    zValidator("json", modifySongVersionSchema),
    async (c) => {
      const { songId, versionId } = c.req.param();
      const data = c.req.valid("json");
      const db = drizzle(c.env.DB);

      try {
        const updated = await db
          .update(songVersion)
          .set({ ...data, updatedAt: new Date() })
          .where(
            and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
          )
          .returning();

        if (!updated.length) {
          return failJSend(c, "Version not found", 404);
        }
        return successJSend(c, updated[0]);
      } catch (error) {
        console.error(error);
        return errorJSend(c, "Failed to update version", 500);
      }
    },
  )

  // Kept for "Spam" or "Mistake" removal
  .delete("/:songId/versions/:versionId", async (c) => {
    try {
      const songId = c.req.param("songId");
      const versionId = c.req.param("versionId");
      const db = drizzle(c.env.DB);

      // Verify version exists and belongs to this song
      const version = await db
        .select()
        .from(songVersion)
        .where(eq(songVersion.id, versionId))
        .limit(1);

      if (version.length === 0 || version[0].songId !== songId) {
        return failJSend(
          c,
          "Version not found or doesn't belong to this song",
          404,
          "VERSION_NOT_FOUND",
        );
      }

      // don't allow deletion of current version
      const songData = await findSong(db, songId);
      if (songData.currentVersionId === versionId) {
        return failJSend(
          c,
          "Cannot delete active version.",
          500,
          "DELETE_ERROR",
        );
      }

      // Soft delete
      const updatedVersion = await db
        .update(songVersion)
        .set({
          updatedAt: new Date(),
          status: "deleted",
        })
        .where(eq(songVersion.id, versionId))
        .returning();

      return successJSend(c, updatedVersion[0]);
    } catch (error) {
      console.error(error);
      return failJSend(c, "Failed to delete version", 500, "DELETE_ERROR");
    }
  })
  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now().toString();
    await c.env.KV.put("songDB-version", newVersion);
    return successJSend(c, newVersion);
  });
