import { and, eq } from "drizzle-orm";
import { AppDatabase } from "../api/utils";
import { user, userFavoriteSongs } from "src/lib/db/schema";
import { SongbookEntryApi } from "../api/api-types";
import { resolveSongbookSongs } from "./song-helpers";

// Raw songbook rows for a user (membership + their pin/key/capo), no song
// resolution. Internal; callers use the `get*SongbookEntries` wrappers below.
const getFavorites = async (
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

  return result;
};

/**
 * Attaches a resolved `song` only to entries whose pinned version isn't the
 * canonical current one — i.e. drafts that aren't in the global song list (a
 * pending edit, or a foreign draft someone pinned). Canonical entries ship
 * without `song`: the client already has those from the global list (own
 * songbook) or resolves them from it (foreign songbook). So the payload only
 * grows by the handful of drafts, not the whole chordpro of every entry.
 */
const withNonCanonicalSongs = async (
  db: AppDatabase,
  entries: SongbookEntryApi[],
): Promise<SongbookEntryApi[]> => {
  const pinned = entries.filter((e) => e.pinnedVersionId);
  if (pinned.length === 0) return entries;
  const songs = await resolveSongbookSongs(db, pinned, { onlyNonCanonical: true });
  if (songs.size === 0) return entries;
  return entries.map((e) =>
    songs.has(e.songId) ? { ...e, song: songs.get(e.songId) } : e,
  );
};

/**
 * The caller's own songbook entries. Pinned drafts carry a resolved `song` (see
 * `withNonCanonicalSongs`); this is the single source `buildSongDB` uses to
 * surface them.
 */
export const getOwnSongbookEntries = async (
  db: AppDatabase,
  userId: string,
): Promise<SongbookEntryApi[]> =>
  withNonCanonicalSongs(db, await getFavorites(db, userId));

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

  return withNonCanonicalSongs(db, await getFavorites(db, ownerId));
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
      .where(eq(userFavoriteSongs.id, existing.id));
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
