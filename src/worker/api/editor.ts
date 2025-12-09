import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { user } from "../../lib/db/schema";

import { eq } from "drizzle-orm";
import { buildApp } from "./utils";
import { zValidator } from "@hono/zod-validator";
import {
  createSong,
  createSongVersion,
  deleteSongVersion,
  findSong,
  getSongVersionsByUser,
} from "../services/song-service";
import { errorJSend, failJSend, successJSend } from "./responses";

export const editorSubmitSchema = z.object({
  title: z.string(),
  artist: z.string(),
  language: z.string(),
  chordpro: z.string(),
  key: z
    .string()
    .optional()
    .transform((x) => x ?? null),
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
    .union([z.string(), z.number()])
    .optional()
    .transform((x) => (x ? String(x) : null)),
});

export type EditorSubmitSchema = z.infer<typeof editorSubmitSchema>;
export type EditorSubmitSchemaInput = z.input<typeof editorSubmitSchema>;

const editorApp = buildApp()
  .post("/", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;
    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;
      const result = await createSong(db, submission, userId, isTrusted);
      return successJSend(c, {
        song: result.newSong,
        version: result.newVersion,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return errorJSend(c, error.message, 400, "SONG_CREATION_FAILED");
      }
      return errorJSend(c, "Failed to add song", 500, "ADD_SONG_ERROR");
    }
  })
  .put("/:id", zValidator("json", editorSubmitSchema), async (c) => {
    const submission = c.req.valid("json");
    const userId = c.get("USER")?.id;
    const songId = c.req.param("id");

    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const userProfile = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const isTrusted =
        userProfile && userProfile.length > 0 && userProfile[0].isTrusted;

      // ensure a song with the same id exists...
      const existingSong = await findSong(db, songId, false);

      const versionResult = await createSongVersion(
        db,
        submission,
        songId,
        userId,
        isTrusted
      );

      return successJSend(c, { song: existingSong, version: versionResult });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return failJSend(c, error.message, 400, "VERSION_EXISTS");
      }
      return errorJSend(c, "Failed to add song version", 500, "UPDATE_ERROR");
    }
  })
  .get("/submissions", async (c) => {
    const userId = c.get("USER")?.id;
    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      const versions = await getSongVersionsByUser(db, userId);
      return successJSend(c, versions);
    } catch (error) {
      console.error(error);
      return errorJSend(
        c,
        "Failed to retrieve your submissions",
        500,
        "GET_EDITS_ERROR"
      );
    }
  })
  .delete("/:id", async (c) => {
    const userId = c.get("USER")?.id;
    const versionId = c.req.param("id");

    if (!userId) {
      return errorJSend(c, "Authentication required", 401, "AUTH_REQUIRED");
    }
    try {
      const db = drizzle(c.env.DB);
      await deleteSongVersion(db, versionId, userId);
      return successJSend(c, { message: "Version deleted successfully" });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        return errorJSend(c, error.message, 400, "DELETE_VERSION_FAILED");
      }
      return errorJSend(
        c,
        "Failed to delete version",
        500,
        "DELETE_VERSION_ERROR"
      );
    }
  });

export default editorApp;
