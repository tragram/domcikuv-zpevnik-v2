// admin/changes.ts - Change management routes and validators
import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, songChange } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildApp } from "../utils";
import { zValidator } from "@hono/zod-validator";

// Change validation schemas
const verifyChangeSchema = z.object({
  id: z.string().uuid("Invalid change ID format"),
  verified: z.boolean(),
});

export const changeRoutes = buildApp()
  .get("/changes", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const changes = await db
        .select({
          id: songChange.id,
          songId: songChange.songId,
          songTitle: song.title,
          userId: songChange.userId,
          userName: user.name,
          timestamp: songChange.timestamp,
          chordproURL: songChange.chordproURL,
          verified: songChange.verified,
        })
        .from(songChange)
        .leftJoin(song, eq(songChange.songId, song.id))
        .leftJoin(user, eq(songChange.userId, user.id))
        .orderBy(desc(songChange.timestamp));

      return c.json({ changes, count: changes.length });
    } catch (error) {
      console.error("Error fetching changes:", error);
      return c.json(
        { error: "Failed to fetch changes", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .post("/change/verify", zValidator("json", verifyChangeSchema), async (c) => {
    try {
      const { id, verified } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Check if change exists
      const existingChange = await db
        .select({ id: songChange.id })
        .from(songChange)
        .where(eq(songChange.id, id))
        .limit(1);

      if (existingChange.length === 0) {
        return c.json(
          { error: "Change not found", code: "CHANGE_NOT_FOUND" },
          404
        );
      }

      await db
        .update(songChange)
        .set({ verified })
        .where(eq(songChange.id, id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Error verifying change:", error);
      return c.json(
        { error: "Failed to verify change", code: "UPDATE_ERROR" },
        500
      );
    }
  });