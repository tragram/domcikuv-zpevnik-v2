import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod/v4";
import { buildApp } from "./utils";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../helpers/favorite-helpers";
import { errorJSend, notLoggedInFail, successJSend } from "./responses";

const SongSchema = z.object({
  songId: z.string(),
});

const favoritesApp = buildApp()
  .get("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return successJSend(c, []);
      }

      const db = drizzle(c.env.DB);
      const songIds = await getFavorites(db, userData.id);
      return successJSend(c, songIds);
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to fetch favorite songs", 500);
    }
  })
  .post("/", zValidator("json", SongSchema), async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return notLoggedInFail(c);
      }

      const { songId } = c.req.valid("json");
      const db = drizzle(c.env.DB);
      await addFavorite(db, userData.id, songId);
      return successJSend(c, null);
    } catch (error) {
      console.log(error);
      if (error instanceof Error) {
        return errorJSend(c, error.message, 409);
      }
      return errorJSend(c, "Failed to add favorite song", 500);
    }
  })
  .delete("/", zValidator("json", SongSchema), async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return notLoggedInFail(c);
      }

      const { songId } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      await removeFavorite(db, userData.id, songId);

      return successJSend(c, null);
    } catch (error) {
      if (error instanceof Error) {
        return errorJSend(c, error.message, 500);
      }
      return errorJSend(c, "Failed to remove favorite song", 500);
    }
  });

export default favoritesApp;
