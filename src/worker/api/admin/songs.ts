import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  songVersion,
  songIllustration,
  SongDataDB,
  SongVersionDB,
  SongIllustrationDB,
} from "../../../lib/db/schema";
import { eq, desc, isNotNull, and, getTableColumns } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import z from "zod/v4";

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

export const findSong = async (db: DrizzleD1Database, songId: string) => {
  const possiblySong = await db
    .select({
      ...getTableColumns(song),
      ...getTableColumns(songVersion),
      id: song.id,
    })
    .from(song)
    .innerJoin(songVersion, eq(songVersion.id, song.currentVersionId))
    .where(eq(song.id, songId))
    .limit(1);
  if (possiblySong.length === 0) {
    throw new Error("Referenced song not found!");
  }
  return possiblySong[0];
};

export type SongWithCurrentVersion = {
  id: string;
  title: string;
  artist: string;
  key: string | undefined;
  createdAt: string | Date;
  updatedAt: string | Date;
  startMelody: string | undefined;
  language: string;
  tempo: number | undefined;
  capo: number | undefined;
  range: string | undefined;
  chordpro: string;
  currentIllustrationId: string;
  currentVersionId: string;
};

export type SongWithDataDB = SongDataDB & {
  currentVersion?: SongVersionDB;
  versions: SongVersionDB[];
  currentIllustration?: SongIllustrationDB;
  illustrations: SongIllustrationDB[];
};

export const findSongWithVersions = async (
  db: DrizzleD1Database,
  songId: string
): Promise<SongWithDataDB> => {
  const songData = await findSong(db, songId);

  // Get all versions for this song
  const versions = await db
    .select()
    .from(songVersion)
    .where(eq(songVersion.songId, songId))
    .orderBy(desc(songVersion.createdAt));

  // Get all illustrations for this song
  const illustrations = await db
    .select()
    .from(songIllustration)
    .where(eq(songIllustration.songId, songId))
    .orderBy(desc(songIllustration.createdAt));

  // Get current version if exists
  let currentVersion;
  if (songData.currentVersionId) {
    const currentVersionResult = await db
      .select()
      .from(songVersion)
      .where(eq(songVersion.id, songData.currentVersionId))
      .limit(1);
    currentVersion = currentVersionResult[0] || null;
  }

  // Get current illustration if exists
  let currentIllustration;
  if (songData.currentIllustrationId) {
    const currentIllustrationResult = await db
      .select()
      .from(songIllustration)
      .where(eq(songIllustration.id, songData.currentIllustrationId))
      .limit(1);
    currentIllustration = currentIllustrationResult[0] || null;
  }

  return {
    ...songData,
    currentVersion,
    currentIllustration,
    versions,
    illustrations,
  };
};

export const songRoutes = buildApp()
  .get("/", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs: SongDataDB[] = await db
        .select()
        .from(song)
        .orderBy(desc(song.updatedAt));

      return c.json({
        status: "success",
        data: {
          songs,
          count: songs.length,
        },
      });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch songs",
          code: "FETCH_ERROR",
        },
        500
      );
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

      return c.json({
        status: "success",
        data: {
          songs,
          count: songs.length,
        },
      });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch songs",
          code: "FETCH_ERROR",
        },
        500
      );
    }
  })

  .get("/versions", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const versions: SongVersionDB[] = await db
        .select()
        .from(songVersion)
        .orderBy(desc(songVersion.updatedAt));

      return c.json({
        status: "success",
        data: {
          versions,
          count: versions.length,
        },
      });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch songs",
          code: "FETCH_ERROR",
        },
        500
      );
    }
  })

  .get("/:id", async (c) => {
    try {
      const songId = c.req.param("id");
      const db = drizzle(c.env.DB);

      const songWithVersions = await findSongWithVersions(db, songId);

      return c.json({
        status: "success",
        data: songWithVersions,
      });
    } catch (error) {
      console.error("Error fetching song:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch song",
          code: "FETCH_ERROR",
        },
        404
      );
    }
  })

  .put("/:id", zValidator("json", songModificationSchema), async (c) => {
    try {
      const modifiedSong = c.req.valid("json");
      const songId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Check if song exists
      const existingSong = await db
        .select({ id: song.id })
        .from(song)
        .where(eq(song.id, songId))
        .limit(1);

      if (existingSong.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Song not found",
              code: "SONG_NOT_FOUND",
            },
          },
          404
        );
      }

      // Update the song record
      await db
        .update(song)
        .set({ ...modifiedSong, updatedAt: new Date() })
        .where(eq(song.id, songId));

      // Return the updated song with all versions and illustrations
      const songWithVersions = await findSongWithVersions(db, songId);

      return c.json({
        status: "success",
        data: songWithVersions,
      });
    } catch (error) {
      console.error("Error modifying song:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to modify song",
          code: "UPDATE_ERROR",
        },
        500
      );
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

        return c.json({
          status: "success",
          data: newVersion[0],
        });
      } catch (error) {
        console.error("Error creating song version:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to create song version",
            code: "VERSION_CREATE_ERROR",
          },
          500
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
          return c.json(
            {
              status: "fail",
              failData: {
                message: "Version not found or doesn't belong to this song",
                code: "VERSION_NOT_FOUND",
              },
            },
            404
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

        return c.json({
          status: "success",
          data: updatedVersion[0],
        });
      } catch (error) {
        console.error("Error setting current version:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to modify song version",
            code: "MODIFY_SONG_VERSION_ERROR",
          },
          500
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
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Version not found or doesn't belong to this song",
              code: "VERSION_NOT_FOUND",
            },
          },
          404
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

      return c.json({
        status: "success",
        data: updatedSong[0],
      });
    } catch (error) {
      console.error("Error setting current version:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to set current version",
          code: "SET_CURRENT_VERSION_ERROR",
        },
        500
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
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Illustration not found or doesn't belong to this song",
              code: "ILLUSTRATION_NOT_FOUND",
            },
          },
          404
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

      return c.json({
        status: "success",
        data: updatedSong[0],
      });
    } catch (error) {
      console.error("Error setting current illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to set current illustration",
          code: "SET_CURRENT_ILLUSTRATION_ERROR",
        },
        500
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
      return c.json({
        status: "success",
        data: deletedSong[0],
      });
    } catch {
      return c.json(
        {
          status: "fail",
          failData: {
            message: "Failed to delete song",
            code: "SONG_NOT_EXISTS",
          },
        },
        500
      );
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
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Version not found or doesn't belong to this song",
              code: "VERSION_NOT_FOUND",
            },
          },
          404
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
      const songData = findSong(db, songId);
      if ((await songData).currentVersionId === versionId) {
        await db
          .update(song)
          .set({ currentVersionId: null, updatedAt: new Date() })
          .where(eq(song.id, songId));
      }

      return c.json({
        status: "success",
        data: updatedVersion[0],
      });
    } catch {
      return c.json(
        {
          status: "fail",
          failData: {
            message: "Failed to delete version",
            code: "SONG_NOT_EXISTS",
          },
        },
        500
      );
    }
  })

  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now().toString();
    await c.env.KV.put("songDB-version", newVersion);
    return c.json({
      status: "success",
      data: newVersion,
    });
  });
