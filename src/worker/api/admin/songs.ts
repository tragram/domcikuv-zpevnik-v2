import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { song } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import z from "zod/v4";

// Song validation schemas
const songModificationSchema = createInsertSchema(song)
  .partial()
  .omit({ id: true, updatedAt: true, createdAt: true }); // Prevent modifying creation date

export type SongModificationSchema = z.infer<typeof songModificationSchema>;

export const findSong = async (db: DrizzleD1Database, songId: string) => {
  const possiblySong = await db
    .select()
    .from(song)
    .where(eq(song.id, songId))
    .limit(1);
  if (possiblySong.length === 0) {
    throw new Error("Referenced song not found!");
  }
  return possiblySong[0];
};

export const songRoutes = buildApp()
  .get("/", async (c) => {
    // TODO: only show songs that are not deleted
    try {
      const db = drizzle(c.env.DB);
      const songs = await db.select().from(song).orderBy(desc(song.updatedAt));

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

  .put("/:id", zValidator("json", songModificationSchema), async (c) => {
    // TODO: this should add a song version
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
              illustrationId: "Song not found",
              code: "SONG_NOT_FOUND",
            },
          },
          404
        );
      }
      const updatedSong = await db
        .update(song)
        .set({ ...modifiedSong, updatedAt: new Date() })
        .where(eq(song.id, songId))
        .returning();

      return c.json({
        status: "success",
        data: updatedSong[0],
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

  .delete("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const songId = c.req.param("id");
    try {
      findSong(db, songId);
      const deletedSong = await db
        .update(song)
        .set({ deleted: true })
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

  .post("/reset-songDB-version", async (c) => {
    const newVersion = Date.now();
    await c.env.KV.put("songDB-version", newVersion);
    return c.json({
      status: "success",
      data: newVersion,
    });
  });
