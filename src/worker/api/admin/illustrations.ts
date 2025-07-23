import { drizzle } from "drizzle-orm/d1";
import { song, songIllustration } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";

// Illustration validation schemas
const illustrationCreateSchema = createInsertSchema(songIllustration).omit({
  id: true,
  createdAt: true,
});

const illustrationModifySchema = createInsertSchema(songIllustration)
  .partial()
  .required({ id: true })
  .omit({ createdAt: true }); // Prevent modifying creation date

export const illustrationRoutes = buildApp()
  .get("/illustrations", async (c) => {
    try {
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
        .orderBy(desc(songIllustration.createdAt));

      return c.json({ illustrations, count: illustrations.length });
    } catch (error) {
      console.error("Error fetching illustrations:", error);
      return c.json(
        { error: "Failed to fetch illustrations", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .post(
    "/illustration/create",
    zValidator("json", illustrationCreateSchema),
    async (c) => {
      try {
        const illustrationData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify the song exists
        const songExists = await db
          .select({ id: song.id })
          .from(song)
          .where(eq(song.id, illustrationData.songId))
          .limit(1);

        if (songExists.length === 0) {
          return c.json(
            { error: "Referenced song not found", code: "SONG_NOT_FOUND" },
            400
          );
        }

        // If this illustration is being set as active, deactivate all other illustrations for this song
        if (illustrationData.isActive) {
          await db
            .update(songIllustration)
            .set({ isActive: false })
            .where(eq(songIllustration.songId, illustrationData.songId));
        }

        const newId = crypto.randomUUID();
        await db.insert(songIllustration).values({
          id: newId,
          ...illustrationData,
          createdAt: new Date(),
        });

        return c.json({ success: true, id: newId }, 201);
      } catch (error) {
        console.error("Error creating illustration:", error);
        return c.json(
          { error: "Failed to create illustration", code: "CREATE_ERROR" },
          500
        );
      }
    }
  )

  .post(
    "/illustration/modify",
    zValidator("json", illustrationModifySchema),
    async (c) => {
      try {
        const modifiedIllustration = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Check if illustration exists and get its song ID
        const existingIllustration = await db
          .select({
            id: songIllustration.id,
            songId: songIllustration.songId,
          })
          .from(songIllustration)
          .where(eq(songIllustration.id, modifiedIllustration.id))
          .limit(1);

        if (existingIllustration.length === 0) {
          return c.json(
            { error: "Illustration not found", code: "ILLUSTRATION_NOT_FOUND" },
            404
          );
        }

        const songId = existingIllustration[0].songId;
        console.log(modifiedIllustration);
        
        // If this illustration is being set as active, deactivate all other illustrations for this song
        if (modifiedIllustration.isActive === true) {
          await db
            .update(songIllustration)
            .set({ isActive: false })
            .where(eq(songIllustration.songId, songId));
        }

        await db
          .update(songIllustration)
          .set(modifiedIllustration)
          .where(eq(songIllustration.id, modifiedIllustration.id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Error modifying illustration:", error);
        return c.json(
          { error: "Failed to modify illustration", code: "UPDATE_ERROR" },
          500
        );
      }
    }
  )

  .delete("/illustration/:id", async (c) => {
    try {
      const illustrationId = c.req.param("id");
      const db = drizzle(c.env.DB);

      // Basic UUID validation
      if (!illustrationId || illustrationId.length < 10) {
        return c.json(
          { error: "Invalid illustration ID format", code: "INVALID_ID" },
          400
        );
      }

      // Check if illustration exists
      const existingIllustration = await db
        .select({ id: songIllustration.id })
        .from(songIllustration)
        .where(eq(songIllustration.id, illustrationId))
        .limit(1);

      if (existingIllustration.length === 0) {
        return c.json(
          { error: "Illustration not found", code: "ILLUSTRATION_NOT_FOUND" },
          404
        );
      }

      await db
        .delete(songIllustration)
        .where(eq(songIllustration.id, illustrationId));

      return c.json({ success: true });
    } catch (error) {
      console.error("Error deleting illustration:", error);
      return c.json(
        { error: "Failed to delete illustration", code: "DELETE_ERROR" },
        500
      );
    }
  });