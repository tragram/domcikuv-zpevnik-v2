import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import {
  song,
  songVersion,
  user,
  userFavoriteSongs,
} from "../../lib/db/schema";

import { eq, desc, isNotNull, and, getTableColumns, isNull } from "drizzle-orm";
import { buildApp } from "./utils";
import { SongData } from "../../web/types/songData";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import { findSong } from "./admin/songs";

const editorSubmitSchema = z.object({
  title: z.string(),
  artist: z.string(),
  key: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  language: z.string(),
  capo: z
    .number()
    .optional()
    .transform((x) => x ?? null),
  range: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  startMelody: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  tempo: z
    .string()
    .optional()
    .transform((x) => x ?? null),
  chordpro: z.string(),
});

export type EditorSubmitSchema = z.infer<typeof editorSubmitSchema>;

const editorApp = buildApp()
  .post("/", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;

    if (!userId) {
      return c.json(
        {
          status: "error",
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        401
      );
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const now = new Date();

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;
      let songId = SongData.baseId(submission.title, submission.artist);
      const existingSong = await db
        .select()
        .from(song)
        .where(eq(song.id, songId))
        .limit(1);
      if (existingSong.length > 0) {
        // on conflict add a timestamp
        songId = songId + "_" + now.getTime();
      }
      const versionId = songId + "_" + now.getTime();
      let newSong;
      let newVersion;
      await db.transaction(async (tx) => {
        newSong = await tx
          .insert(song)
          .values({
            id: songId,
            createdAt: now,
            updatedAt: now,
            hidden: isTrusted,
            currentVersionId: versionId,
          })
          .returning();

        newVersion = await tx
          .insert(songVersion)
          .values({
            ...submission,
            id: versionId,
            songId: songId,
            createdAt: now,
            updatedAt: now,
            userId: userId,
            approved: isTrusted,
            approvedBy: isTrusted ? userProfile[0].id : null,
            approvedAt: isTrusted ? now : null,
          })
          .returning();
      });
      console.log(newSong, newVersion);
      return c.json({
        status: "success",
        data: {
          song: newSong,
          version: newVersion,
        },
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          status: "error",
          message: "Failed to add song",
          code: "ADD_SONG_ERROR",
        },
        500
      );
    }
  })
  .put("/:id", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;
    const songId = c.req.param("id");

    if (!userId) {
      return c.json(
        {
          status: "error",
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        401
      );
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const now = new Date();

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;

      // ensure a song with the same id exists...
      let existingSong = await findSong(db, songId, false);
      const versionId = songId + "_" + now.getTime();

      // make sure the same version does not exist yet (at least by the same user)
      const sameVersion = await db
        .select()
        .from(songVersion)
        .where(
          and(
            eq(songVersion.songId, songId),
            eq(songVersion.artist, submission.artist),
            eq(songVersion.title, submission.title),
            eq(songVersion.language, submission.language),
            eq(songVersion.userId, userId),
            eq(songVersion.chordpro, submission.chordpro),
            // handling nullable fields is ugly
            submission.key === null
              ? isNull(songVersion.key)
              : eq(songVersion.key, submission.key),
            submission.capo === null
              ? isNull(songVersion.capo)
              : eq(songVersion.capo, submission.capo),
            submission.range === null
              ? isNull(songVersion.range)
              : eq(songVersion.range, submission.range),
            submission.startMelody === null
              ? isNull(songVersion.startMelody)
              : eq(songVersion.startMelody, submission.startMelody),
            submission.tempo === null
              ? isNull(songVersion.tempo)
              : eq(songVersion.tempo, submission.tempo)
          )
        )
        .limit(1);
      if (sameVersion.length > 0) {
        return c.json(
          {
            status: "fail",
            failData: {
              message: "Version with the same ",
              code: "SONG_NOT_FOUND",
            },
          },
          400
        );
      }

      const newVersion = await db
        .insert(songVersion)
        .values({
          ...submission,
          id: versionId,
          songId: songId,
          createdAt: now,
          updatedAt: now,
          userId: userId,
          approved: isTrusted,
          approvedBy: isTrusted ? userProfile[0].id : null,
          approvedAt: isTrusted ? now : null,
        })
        .returning();
      if (isTrusted) {
        existingSong = (
          await db
            .update(song)
            .set({ currentVersionId: versionId })
            .where(eq(song.id, songId))
            .returning()
        )[0];
      }
      console.log(newVersion);
      return c.json({
        status: "success",
        data: { song: existingSong, version: newVersion },
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          status: "error",
          message: "Failed to add song version",
          code: "UPDATE_ERROR",
        },
        500
      );
    }
  });

export default editorApp;
