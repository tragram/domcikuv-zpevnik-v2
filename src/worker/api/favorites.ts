
import { z } from "zod";
import { buildApp } from "./utils";
import {
  getOwnSongbookEntries,
  getPublicSongbookEntries,
  removeFavorite,
  setSongbookEntry,
} from "../helpers/favorite-helpers";
import { notLoggedInFail, successJSend, zValidatorJSend } from "./responses";

const SongSchema = z.object({
  songId: z.string(),
});

// Personal per-song overrides. All optional so the client can patch just one.
const SongbookEntrySchema = z.object({
  keyIndex: z.number().int().min(0).max(11).nullable().optional(),
  capo: z.number().int().nullable().optional(),
  pinnedVersionId: z.string().nullable().optional(),
});

// Adding to the songbook can carry the key/capo set up at that moment, plus a
// pinned version — used when liking a draft (e.g. another user's pending edit)
// so the songbook keeps showing that exact version.
const AddFavoriteSchema = SongSchema.extend({
  keyIndex: z.number().int().min(0).max(11).optional(),
  capo: z.number().int().optional(),
  pinnedVersionId: z.string().optional(),
});

const favoritesApp = buildApp()
  .get("/", async (c) => {
    const userData = c.var.USER;
    if (!userData) return successJSend(c, []);

    const entries = await getOwnSongbookEntries(c.var.db, userData.id);
    return successJSend(c, entries);
  })
  // Another user's public songbook entries (key/capo/version), for viewers
  // browsing that songbook. Returns [] when the songbook isn't public.
  .get("/of/:userId", async (c) => {
    const entries = await getPublicSongbookEntries(
      c.var.db,
      c.req.param("userId"),
    );
    return successJSend(c, entries);
  })
  .post("/", zValidatorJSend("json", AddFavoriteSchema), async (c) => {
    const userData = c.var.USER;
    if (!userData) return notLoggedInFail(c);

    const { songId, keyIndex, capo, pinnedVersionId } = c.req.valid("json");

    // Capture the key/capo/version set up at the moment of adding (if provided).
    // Upsert is idempotent, so re-adding is harmless.
    const patch: { keyIndex?: number; capo?: number; pinnedVersionId?: string } =
      {};
    if (keyIndex !== undefined) patch.keyIndex = keyIndex;
    if (capo !== undefined) patch.capo = capo;
    if (pinnedVersionId !== undefined) patch.pinnedVersionId = pinnedVersionId;
    await setSongbookEntry(c.var.db, userData.id, songId, patch);

    return successJSend(c, null);
  })
  .delete("/", zValidatorJSend("json", SongSchema), async (c) => {
    const userData = c.var.USER;
    if (!userData) return notLoggedInFail(c);

    const { songId } = c.req.valid("json");
    await removeFavorite(c.var.db, userData.id, songId);

    return successJSend(c, null);
  })
  // Save the caller's personal key/capo (and optionally pin) for a song,
  // adding it to their songbook if it isn't there yet.
  .patch(
    "/:songId",
    zValidatorJSend("json", SongbookEntrySchema),
    async (c) => {
      const userData = c.var.USER;
      if (!userData) return notLoggedInFail(c);

      const songId = c.req.param("songId");
      await setSongbookEntry(c.var.db, userData.id, songId, c.req.valid("json"));

      return successJSend(c, null);
    },
  );

export default favoritesApp;
