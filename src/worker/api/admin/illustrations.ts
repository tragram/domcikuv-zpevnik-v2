import { drizzle } from "drizzle-orm/d1";
import {
  song,
  SongDataDB,
  songIllustration,
  SongIllustrationDB,
} from "../../../lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import z from "zod/v4";
import { findSong } from "./songs";

// Illustration validation schemas
const illustrationCreateSchema = createInsertSchema(songIllustration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const illustrationModifySchema = createInsertSchema(songIllustration)
  .partial()
  .required({ id: true })
  // Prevent modifying creation date and referenced song
  .omit({ createdAt: true, songId: true, updatedAt: true });

export type IllustrationModifySchema = z.infer<typeof illustrationModifySchema>;
export type IllustrationCreateSchema = z.infer<typeof illustrationCreateSchema>;

const responseData = (song: SongDataDB, illustration: SongIllustrationDB) => {
  return {
    song: {
      title: song.title,
      artist: song.artist,
    },
    ...illustration,
  };
};

export type IllustrationApiResponse = ReturnType<typeof responseData>;

export const illustrationRoutes = buildApp()
  .get("/illustrations", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const illustrations = await db
        .select({ song, songIllustration })
        .from(songIllustration)
        .innerJoin(song, eq(songIllustration.songId, song.id))
        .orderBy(desc(songIllustration.createdAt));
      return c.json({
        status: "success",
        data: {
          illustrations: illustrations.map((i) =>
            responseData(i.song, i.songIllustration)
          ) as IllustrationApiResponse[],
          count: illustrations.length,
        },
      });
    } catch (error) {
      console.error("Error fetching illustrations:", error);
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

  .post(
    "/illustration/create",
    zValidator("json", illustrationCreateSchema),
    async (c) => {
      try {
        const illustrationData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify the song exists
        let illustrationSong;
        try {
          illustrationSong = await findSong(db, illustrationData.songId);
        } catch {
          return c.json(
            {
              status: "fail",
              failData: { "songId": "Referenced song not found" },
            },
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
        
        // TODO: onConflict
        const newId = `${illustrationData.songId}_${illustrationData.promptModel}_${illustrationData.promptId}_${illustrationData.imageModel}`;
        const newIllustration = await db
          .insert(songIllustration)
          .values({
            id: newId,
            ...illustrationData,
            createdAt: new Date(),
          })
          .returning();

        return c.json(
          {
            status: "success",
            data: responseData(
              illustrationSong,
              newIllustration[0]
            ) as IllustrationApiResponse,
          },
          201
        );
      } catch (error) {
        console.error("Error creating illustration:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to create illustration",
            code: "CREATE_ERROR",
          },
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
            {
              status: "fail",
              failData: {
                illustrationId: "Illustration not found",
                code: "ILLUSTRATION_NOT_FOUND",
              },
            },
            404
          );
        }

        const songId = existingIllustration[0].songId;
        // If this illustration is being set as active, deactivate all other illustrations for this song
        if (modifiedIllustration.isActive === true) {
          await db
            .update(songIllustration)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
              and(
                eq(songIllustration.songId, songId),
                eq(songIllustration.isActive, true)
              )
            );
        }

        const updatedIllustration = await db
          .update(songIllustration)
          .set(modifiedIllustration)
          .where(eq(songIllustration.id, modifiedIllustration.id))
          .returning();
        let illustrationSong;
        try {
          illustrationSong = await findSong(db, songId);
        } catch {
          return c.json(
            {
              status: "fail",
              failData: { "song.id": "Referenced song not found" },
            },
            400
          );
        }

        return c.json({
          status: "success",
          data: responseData(
            illustrationSong,
            updatedIllustration[0]
          ) as IllustrationApiResponse,
        });
      } catch (error) {
        console.error("Error modifying illustration:", error);
        return c.json(
          {
            status: "error",
            message: "Failed to modify illustration",
            code: "UPDATE_ERROR",
          },
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
          {
            status: "fail",
            failData: {
              illustrationId: "Invalid illustration ID format",
              code: "INVALID_ID",
            },
          },
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
          {
            status: "fail",
            failData: {
              illustrationId: "Illustration not found",
              code: "ILLUSTRATION_NOT_FOUND",
            },
          },
          404
        );
      }

      await db
        .delete(songIllustration)
        .where(eq(songIllustration.id, illustrationId));

      return c.json({
        status: "success",
        data: null,
      });
    } catch (error) {
      console.error("Error deleting illustration:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to delete illustration",
          code: "DELETE_ERROR",
        },
        500
      );
    }
  });
