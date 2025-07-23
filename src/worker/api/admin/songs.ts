import { drizzle } from "drizzle-orm/d1";
import { song } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";

// Song validation schemas
const songModificationSchema = createInsertSchema(song)
  .partial()
  .required({ id: true })
  .omit({ dateAdded: true }); // Prevent modifying creation date

export const songRoutes = buildApp()
  .get("/songDB", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs = await db
        .select()
        .from(song)
        .orderBy(desc(song.dateModified));

      return c.json({ songs, count: songs.length });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return c.json(
        { error: "Failed to fetch songs", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .post(
    "/song/modify",
    zValidator("json", songModificationSchema),
    async (c) => {
      try {
        const modifiedSong = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Check if song exists
        const existingSong = await db
          .select({ id: song.id })
          .from(song)
          .where(eq(song.id, modifiedSong.id))
          .limit(1);

        if (existingSong.length === 0) {
          return c.json(
            { error: "Song not found", code: "SONG_NOT_FOUND" },
            404
          );
        }

        await db
          .update(song)
          .set({ ...modifiedSong, dateModified: new Date() })
          .where(eq(song.id, modifiedSong.id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Error modifying song:", error);
        return c.json(
          { error: "Failed to modify song", code: "UPDATE_ERROR" },
          500
        );
      }
    }
  );