import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user, userFavoriteSongs } from "src/lib/db/schema";
import { z } from "zod/v4";
import { buildApp } from "./utils";

const SongSchema = z.object({
  songId: z.string(),
});

const favoritesApp = buildApp()
  .get("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json([]);
      }

      const db = drizzle(c.env.DB);
      const result = await db
        .select({ songId: userFavoriteSongs.songId })
        .from(userFavoriteSongs)
        .where(eq(userFavoriteSongs.userId, userData.id));

      const songIds = result.map((row) => row.songId);
      return c.json(songIds);
    } catch (error) {
      return c.json({ error: "Failed to fetch favorite songs" }, 500);
    }
  })
  .post("/", zValidator("json", SongSchema), async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json(
          { error: "Cannot add favorite song - no user logged in!" },
          401
        );
      }

      const { songId } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      await db.insert(userFavoriteSongs).values({
        userId: userData.id,
        songId,
      });

      return c.json({ success: true });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: (error as Error).message,
        },
        500
      );
    }
  })
  .delete("/", zValidator("json", SongSchema), async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json(
          { error: "Cannot remove favorite song - no user logged in!" },
          401
        );
      }

      const { songId } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      await db
        .delete(userFavoriteSongs)
        .where(
          and(
            eq(userFavoriteSongs.userId, userData.id),
            eq(userFavoriteSongs.songId, songId)
          )
        );

      return c.json({ success: true });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: (error as Error).message,
        },
        500
      );
    }
  })
  .get("/public", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json({ error: "User not found" }, 404);
      }

      const db = drizzle(c.env.DB);
      const result = await db
        .select({ isFavoritesPublic: user.isFavoritesPublic })
        .from(user)
        .where(eq(user.id, userData.id));

      return c.json(result);
    } catch (error) {
      return c.json({ error: "Failed to fetch user preferences" }, 500);
    }
  });
export default favoritesApp;
