import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, userFavoriteSongs } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { buildApp } from "./utils";
import { SongData } from "../../web/types/songData";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";

const adminApp = buildApp()
  .use(async (c, next) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;
    if (!userId) {
      return c.json(
        { error: "You need to be logged in as admin to visit this page" },
        401
      );
    }
    const isAdminResult = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId));
    if (isAdminResult.length > 1) {
      console.error(
        "Found multiple users with the same userID!",
        isAdminResult
      );
    }

    const isAdmin = isAdminResult[0]?.isAdmin;
    if (import.meta.env.DEV || isAdmin) {
      return next();
    }
    return c.json({ error: "You need to be an admin to visit this page" }, 401);
  })
  .get("/songDB", async (c) => {
    const db = drizzle(c.env.DB);
    const songDB = await db.select().from(song);
    return c.json(songDB);
  })
  .post(
    "/song/modify",
    zValidator(
      "json",
      createInsertSchema(song).partial().required({ id: true })
    ),
    async (c) => {
      const modifiedSong = c.req.valid("json");
      console.log(modifiedSong);
      const db = drizzle(c.env.DB);
      await db
        .update(song)
        .set({ ...modifiedSong, dateModified: new Date() })
        .where(eq(song.id, modifiedSong.id));
      return c.json({ success: true });
    }
  );

export default adminApp;
