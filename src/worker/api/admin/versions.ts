import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, songVersion } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildApp } from "../utils";
import { zValidator } from "@hono/zod-validator";

// Version validation schemas
const verifyVersionSchema = z.object({
  id: z.uuid("Invalid version ID format"),
  verified: z.boolean(),
});

export const versionRoutes = buildApp()
  .get("/versions", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const versions = await db
        .select({
          id: songVersion.id,
          songId: songVersion.songId,
          songTitle: song.title,
          userId: songVersion.userId,
          userName: user.name,
          timestamp: songVersion.timestamp,
          chordproURL: songVersion.chordproURL,
          verified: songVersion.verified,
        })
        .from(songVersion)
        .leftJoin(song, eq(songVersion.songId, song.id))
        .leftJoin(user, eq(songVersion.userId, user.id))
        .orderBy(desc(songVersion.timestamp));

      return c.json({
        status: "success",
        data: { versions, count: versions.length },
      });
    } catch (error) {
      console.error("Error fetching versions:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch illustrations",
          code: "FETCH_ERROR",
        },
        500
      );
    }
  })

  .post("/version/verify", zValidator("json", verifyVersionSchema), async (c) => {
    try {
      const { id, verified } = c.req.valid("json");
      const user = c.get("USER");
      if (!user) {
        // this should've been checked before, so this is mostly for TS...
        return c.json(
          {
            status: "error",
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
          404
        );
      }
      const db = drizzle(c.env.DB);

      // Check if version exists
      const existingVersion = await db
        .select({ id: songVersion.id })
        .from(songVersion)
        .where(eq(songVersion.id, id))
        .limit(1);

      if (existingVersion.length === 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              illustrationId: "Version not found",
              code: "VERSION_NOT_FOUND",
            },
          },
          404
        );
      }

      const verifiedVersion = await db
        .update(songVersion)
        .set({ verified, verifiedAt: new Date(), verifiedByUser: user.id })
        .where(eq(songVersion.id, id))
        .returning();

      return c.json({
        status: "success",
        data: verifiedVersion,
      });
    } catch (error) {
      console.error("Error verifying version:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to modify illustration",
          code: "UPDATE_ERROR",
        },
        500
      );
    }
  });
