import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, userFavoriteSongs, songIllustration } from "../../lib/db/schema";
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
  .get("/illustrations", async (c) => {
    const db = drizzle(c.env.DB);
    const illustrations = await db
      .select({
        id: songIllustration.id,
        songId: songIllustration.songId,
        songTitle: song.title,
        promptId: songIllustration.promptId,
        promptModel: songIllustration.promptModel,
        imageModel: songIllustration.imageModel,
        imageURL: songIllustration.imageURL,
        thumbnailURL: songIllustration.thumbnailURL,
        isActive: songIllustration.isActive,
        createdAt: songIllustration.createdAt,
      })
      .from(songIllustration)
      .leftJoin(song, eq(songIllustration.songId, song.id))
      .orderBy(songIllustration.createdAt);
    
    return c.json(illustrations);
  })
  .post(
    "/illustration/create",
    zValidator(
      "json",
      createInsertSchema(songIllustration).omit({ id: true, createdAt: true })
    ),
    async (c) => {
      const illustrationData = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      const newId = crypto.randomUUID();
      await db.insert(songIllustration).values({
        id: newId,
        ...illustrationData,
        createdAt: new Date(),
      });
      
      return c.json({ success: true, id: newId });
    }
  )
  .post(
    "/illustration/modify",
    zValidator(
      "json",
      createInsertSchema(songIllustration).partial().required({ id: true })
    ),
    async (c) => {
      const modifiedIllustration = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      await db
        .update(songIllustration)
        .set(modifiedIllustration)
        .where(eq(songIllustration.id, modifiedIllustration.id));
      
      return c.json({ success: true });
    }
  )
  .delete("/illustration/:id", async (c) => {
    const id = c.req.param("id");
    const db = drizzle(c.env.DB);
    
    await db
      .delete(songIllustration)
      .where(eq(songIllustration.id, id));
    
    return c.json({ success: true });
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