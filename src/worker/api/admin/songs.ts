import { drizzle } from "drizzle-orm/d1";
import {
  song,
  songVersion,
  songIllustration,
  SongDataDB,
  SongVersionDB,
} from "../../../lib/db/schema";
import { eq, desc, isNotNull, and, getTableColumns } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import z from "zod/v4";
import {
  findSong,
  findSongWithVersions,
  SongWithCurrentVersion,
} from "../../services/song-service";
import {
  errorJSend,
  failJSend,
  songNotFoundFail,
  successJSend,
} from "../responses";

// Song validation schemas
const songModificationSchema = createInsertSchema(song)
  .partial()
  .omit({ id: true, updatedAt: true, createdAt: true }); // Prevent modifying creation date

const newSongVersionSchema = createInsertSchema(songVersion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const modifySongVersionSchema = newSongVersionSchema.partial();

export type SongModificationSchema = z.infer<typeof songModificationSchema>;
export type NewSongVersionSchema = z.infer<typeof newSongVersionSchema>;
export type ModifySongVersionSchema = z.infer<typeof modifySongVersionSchema>;

export const songRoutes = buildApp()
  .get("/", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs: SongDataDB[] = await db
        .select()
        .from(song)
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
        .where(
          and(
            isNotNull(song.currentVersionId),
            eq(song.hidden, false),
            eq(song.deleted, false)
          )
        )
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

      return successJSend(c, {
        versions,
        count: versions.length,
      });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return errorJSend(c, "Failed to fetch songs", 500, "FETCH_ERROR");
    }
  })

  .get("/:id", async (c) => {
    try {
      const songId = c.req.param("id");
      const db = drizzle(c.env.DB);

      const songWithVersions = await findSongWithVersions(db, songId);

      return successJSend(c, songWithVersions);
    } catch (error) {
      console.error("Error fetching song:", error);
      return errorJSend(c, "Failed to fetch song", 404, "FETCH_ERROR");
    }
  })

  .put("/:id", zValidator("json", songModificationSchema), async (c) => {
    try {
      const modifiedSong = c.req.valid("json");
      const songId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Check if song exists
      await findSong(db, songId);

      // Update the song record
      await db
        .update(song)
        .set({ ...modifiedSong, updatedAt: new Date() })
        .where(eq(song.id, songId));

      // Return the updated song with all versions and illustrations
      const songWithVersions = await findSongWithVersions(db, songId);

      return successJSend(c, songWithVersions);
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to modify song", 500, "UPDATE_ERROR");
    }
  })

  .post(
    "/:songId/versions",
    zValidator("json", newSongVersionSchema),
    async (c) => {
      try {
        const versionData = c.req.valid("json");
        const songId = c.req.param("songId");
        const db = drizzle(c.env.DB);

        // Verify song exists
        await findSong(db, songId);

        // Generate ID for the new version
        const versionId = `${songId}_${Date.now()}`;

        // Create new version
        const newVersion = await db
          .insert(songVersion)
          .values({
            id: versionId,
            ...versionData,
            songId: songId,
          })
          .returning();

        return successJSend(c, newVersion[0]);
      } catch (error) {
        console.error("Error creating song version:", error);
        return errorJSend(
          c,
          "Failed to create song version",
          500,
          "VERSION_CREATE_ERROR"
        );
      }
    }
  )

  .put(
    ":songId/versions/:versionId",
    zValidator("json", modifySongVersionSchema),
    async (c) => {
      try {
        const songId = c.req.param("songId");
        const versionId = c.req.param("versionId");
        const versionData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify version exists and belongs to this song
        const version = await db
          .select()
          .from(songVersion)
          .where(eq(songVersion.id, versionId))
          .limit(1);

        if (version.length === 0 || version[0].songId !== songId) {
          failJSend(
            c,
            "Version not found or doesn't belong to this song",
            404,
            "VERSION_NOT_FOUND"
          );
        }

        // Update the song's current version
        const updatedVersion = await db
          .update(songVersion)
          .set({
            ...versionData,
            updatedAt: new Date(),
          })
          .where(eq(songVersion.id, versionId))
          .returning();

        return successJSend(c, updatedVersion[0]);
      } catch (error) {
        console.error("Error setting current version:", error);
        return errorJSend(
          c,
          "Failed to modify song version",
          500,
          "MODIFY_SONG_VERSION_ERROR"
        );
      }
    }
  )

  .put("/:songId/current-version/:versionId", async (c) => {
    try {
      const songId = c.req.param("songId");
      const versionId = c.req.param("versionId");
      const db = drizzle(c.env.DB);

      // Verify song exists
      await findSong(db, songId);

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

      // Update the song's current version
      const updatedSong = await db
        .update(song)
        .set({
          currentVersionId: versionId,
          updatedAt: new Date(),
        })
        .where(eq(song.id, songId))
        .returning();

      return successJSend(c, updatedSong[0]);
    } catch (error) {
      console.error("Error setting current version:", error);
      return errorJSend(
        c,
        "Failed to set current version",
        500,
        "SET_CURRENT_VERSION_ERROR"
      );
    }
  })

  .put("/:songId/current-illustration/:illustrationId", async (c) => {
    try {
      const songId = c.req.param("songId");
      const illustrationId = c.req.param("illustrationId");
      const db = drizzle(c.env.DB);

      // Verify illustration exists and belongs to this song
      const illustration = await db
        .select()
        .from(songIllustration)
        .where(eq(songIllustration.id, illustrationId))
        .limit(1);

      if (illustration.length === 0 || illustration[0].songId !== songId) {
        return failJSend(
          c,
          "Illustration not found or doesn't belong to this song",
          404,
          "ILLUSTRATION_NOT_FOUND"
        );
      }

      // Update the song's current illustration
      const updatedSong = await db
        .update(song)
        .set({
          currentIllustrationId: illustrationId,
          updatedAt: new Date(),
        })
        .where(eq(song.id, songId))
        .returning();

      return successJSend(c, updatedSong[0]);
    } catch (error) {
      console.error("Error setting current illustration:", error);
      return errorJSend(
        c,
        "Failed to set current illustration",
        500,
        "SET_CURRENT_ILLUSTRATION_ERROR"
      );
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
    } catch {
      return songNotFoundFail(c);
    }
  })

  .delete(":songId/versions/:versionId", async (c) => {
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
          "VERSION_NOT_FOUND"
        );
      }

      // Update the song's deleted state
      const updatedVersion = await db
        .update(songVersion)
        .set({
          updatedAt: new Date(),
          deleted: true,
        })
        .where(eq(songVersion.id, versionId))
        .returning();

      // remove from currentVersion if it is selected
      const songData = await findSong(db, songId);
      if (songData.currentVersionId === versionId) {
        await db
          .update(song)
          .set({ currentVersionId: null, updatedAt: new Date() })
          .where(eq(song.id, songId));
      }

      return successJSend(c, updatedVersion[0]);
    } catch {
      return songNotFoundFail(c);
    }
  })

  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now().toString();
    await c.env.KV.put("songDB-version", newVersion);
    return successJSend(c, newVersion);
  });
