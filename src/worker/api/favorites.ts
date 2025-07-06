import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
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
  .get("/publicSongbooks", async (c) => {
    async function getPublicSongbooks(db: DrizzleD1Database) {
      return await db
        .select({
          user: user,
          userId: user.id,
          userName: user.name,
          userNickname: user.nickname,
          userImage: user.image,
          songId: userFavoriteSongs.songId,
        })
        .from(user)
        .innerJoin(userFavoriteSongs, eq(user.id, userFavoriteSongs.userId))
        .where(eq(user.isFavoritesPublic, true))
        .orderBy(user.name, userFavoriteSongs.id);
    }

    try {
      const db = drizzle(c.env.DB);
      const result = await getPublicSongbooks(db);
      const userSongMap = new Map<
        string,
        {
          user: string;
          image: string;
          name: string;
          songIds: string[];
        }
      >();

      result.forEach((row) => {
        const userId = row.userId;

        if (!userSongMap.has(userId)) {
          userSongMap.set(userId, {
            user: userId,
            image: row.userImage || "", // handle null image
            name: row.userNickname ?? row.userName,
            songIds: [],
          });
        }

        userSongMap.get(userId)!.songIds.push(row.songId);
      });

      return c.json(Array.from(userSongMap.values()));
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to fetch public songbooks!" }, 500);
    }
  });
export default favoritesApp;
