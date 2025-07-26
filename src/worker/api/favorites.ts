import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { userFavoriteSongs } from "src/lib/db/schema";
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
        return c.json({
          status: "success",
          data: [],
        });
      }

      const db = drizzle(c.env.DB);
      const result = await db
        .select({ songId: userFavoriteSongs.songId })
        .from(userFavoriteSongs)
        .where(eq(userFavoriteSongs.userId, userData.id));

      const songIds = result.map((row) => row.songId);
      return c.json({
        status: "success",
        data: songIds,
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch favorite songs",
          code: 500,
        },
        500
      );
    }
  })
  .post("/", zValidator("json", SongSchema), async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Cannot add favorite song - no user logged in!",
            },
          },
          401
        );
      }

      const { songId } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Check if the favorite already exists
      const existingFavorite = await db
        .select({ id: userFavoriteSongs.id })
        .from(userFavoriteSongs)
        .where(
          and(
            eq(userFavoriteSongs.userId, userData.id),
            eq(userFavoriteSongs.songId, songId)
          )
        )
        .limit(1);

      if (existingFavorite.length > 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Song is already in favorites",
            },
          },
          409
        );
      }

      await db
        .insert(userFavoriteSongs)
        .values({
          userId: userData.id,
          songId,
        })
        .returning();

      return c.json({
        status: "success",
        data: null,
      });
    } catch (error) {
      console.log(error);
      return c.json(
        {
          status: "error",
          message: (error as Error).message,
          code: 500,
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
          {
            status: "fail",
            failData: {
              message: "Cannot remove favorite song - no user logged in!",
            },
          },
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

      return c.json({
        status: "success",
        data: null,
      });
    } catch (error) {
      return c.json(
        {
          status: "error",
          message: (error as Error).message,
          code: 500,
        },
        500
      );
    }
  });

export default favoritesApp;
