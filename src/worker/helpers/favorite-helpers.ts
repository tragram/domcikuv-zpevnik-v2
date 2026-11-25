import { and, eq, or, sql } from "drizzle-orm";
import { AppDatabase } from "../api/utils";
import { song, songVersion, user, userFavoriteSongs } from "src/lib/db/schema";
import { HTTPException } from "hono/http-exception";
import { SongbookEntryApi } from "../api/api-types";
import { getPinnedAlternatives } from "./song-helpers";

export const getOwnSongbookEntries = async (
  db: AppDatabase,
  userId: string,
): Promise<SongbookEntryApi[]> => {
  const result = await db
    .select({
      songId: userFavoriteSongs.songId,
      pinnedVersionId: userFavoriteSongs.pinnedVersionId,
      keyIndex: userFavoriteSongs.keyIndex,
      capo: userFavoriteSongs.capo,
    })
    .from(userFavoriteSongs)
    .where(eq(userFavoriteSongs.userId, userId));

  if (!result.some(entry => entry.pinnedVersionId)) return result;
  const alternatives = await getPinnedAlternatives(db, userId);
  return result.map(entry => {
    const sheet = entry.pinnedVersionId && alternatives.get(entry.pinnedVersionId);
    return sheet && sheet.id === entry.songId ? { ...entry, song: sheet } : entry;
  });
};

/**
 * Another user's songbook entries, but only if they've made their songbook
 * public — used to show their key/capo/version when a viewer browses it. Pinned
 * drafts carry a resolved `song`; canonical entries are resolved client-side
 * from the global list. Returns [] for private or unknown users.
 */
export const getPublicSongbookEntries = async (
  db: AppDatabase,
  ownerId: string,
): Promise<SongbookEntryApi[]> => {
  const owner = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, ownerId), eq(user.isFavoritesPublic, true)))
    .get();
  if (!owner) return [];

  return getOwnSongbookEntries(db, ownerId);
};

/**
 * Sets the caller's personal pin / key / capo for a song, creating the
 * songbook (favorite) row if it doesn't exist yet. Only the fields present in
 * `patch` are changed. Used both by the explicit "save my key & capo" action
 * and to auto-pin a freshly created version to the editor's songbook.
 */
export const setSongbookEntry = async (
  db: AppDatabase,
  userId: string,
  songId: string,
  patch: {
    pinnedVersionId?: string | null;
    keyIndex?: number | null;
    capo?: number | null;
  },
) => {
  const parent = await db.query.song.findFirst({ where: and(eq(song.id, songId), eq(song.deleted, false)), columns: { id: true } });
  if (!parent) throw new HTTPException(404, { message: "Song not found" });
  if (patch.pinnedVersionId) {
    const version = await db.query.songVersion.findFirst({ where: and(eq(songVersion.id, patch.pinnedVersionId), eq(songVersion.songId, songId)), columns: { status: true } });
    if (!version || version.status === "deleted") throw new HTTPException(400, { message: "Choose an available version of this song." });
  }
  const existing = await db
    .select({ id: userFavoriteSongs.id })
    .from(userFavoriteSongs)
    .where(
      and(
        eq(userFavoriteSongs.userId, userId),
        eq(userFavoriteSongs.songId, songId),
      ),
    )
    .get();

  if (existing) {
    if (Object.keys(patch).length === 0) return; // membership already exists
    await db
      .update(userFavoriteSongs)
      .set(patch)
      .where(and(
        eq(userFavoriteSongs.id, existing.id),
        or(
          patch.pinnedVersionId === undefined ? undefined : sql`${userFavoriteSongs.pinnedVersionId} IS NOT ${patch.pinnedVersionId}`,
          patch.keyIndex === undefined ? undefined : sql`${userFavoriteSongs.keyIndex} IS NOT ${patch.keyIndex}`,
          patch.capo === undefined ? undefined : sql`${userFavoriteSongs.capo} IS NOT ${patch.capo}`,
        ),
      ));
  } else {
    await db.insert(userFavoriteSongs).values({ userId, songId, ...patch });
  }
};

export const removeFavorite = async (
  db: AppDatabase,
  userId: string,
  songId: string
) => {
  await db
    .delete(userFavoriteSongs)
    .where(
      and(
        eq(userFavoriteSongs.userId, userId),
        eq(userFavoriteSongs.songId, songId)
      )
    );
};
