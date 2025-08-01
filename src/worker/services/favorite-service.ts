import { and, eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { userFavoriteSongs } from "src/lib/db/schema";

export const getFavorites = async (db: DrizzleD1Database, userId: string) => {
  const result = await db
    .select({ songId: userFavoriteSongs.songId })
    .from(userFavoriteSongs)
    .where(eq(userFavoriteSongs.userId, userId));

  return result.map((row) => row.songId);
};

export const addFavorite = async (
  db: DrizzleD1Database,
  userId: string,
  songId: string
) => {
  // Check if the favorite already exists
  const existingFavorite = await db
    .select({ id: userFavoriteSongs.id })
    .from(userFavoriteSongs)
    .where(
      and(
        eq(userFavoriteSongs.userId, userId),
        eq(userFavoriteSongs.songId, songId)
      )
    )
    .limit(1);

  if (existingFavorite.length > 0) {
    throw new Error("Song is already in favorites");
  }

  await db
    .insert(userFavoriteSongs)
    .values({
      userId: userId,
      songId,
    })
    .returning();
};

export const removeFavorite = async (
  db: DrizzleD1Database,
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
