import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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
    const userData = c.var.USER;
    if (!userData) return successJSend(c, []);

    const songIds = await getFavorites(c.var.db, userData.id);
    return successJSend(c, songIds);
  })
  .post("/", zValidator("json", SongSchema), async (c) => {
    const userData = c.var.USER;
    if (!userData) return notLoggedInFail(c);

    const { songId } = c.req.valid("json");

    try {
      await addFavorite(c.var.db, userData.id, songId);
      return successJSend(c, null);
    } catch (error) {
      // Keep this specific try/catch to handle the 409 constraint error
      if (
        error instanceof Error &&
        error.message.includes("already in favorites")
      ) {
        return errorJSend(c, error.message, 409);
      }
      throw error; // Let the global handler deal with 500s
    }
  })
  .delete("/", zValidator("json", SongSchema), async (c) => {
    const userData = c.var.USER;
    if (!userData) return notLoggedInFail(c);

    const { songId } = c.req.valid("json");
    await removeFavorite(c.var.db, userData.id, songId);

    return successJSend(c, null);
  });

export default favoritesApp;
