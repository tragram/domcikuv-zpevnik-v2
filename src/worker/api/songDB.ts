import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  songIllustration,
  userFavoriteSongs,
  user,
} from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildApp } from "./utils";
import { SongData } from "../../lib/songData";

export const songDBRoutes = buildApp().get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("USER")?.id;

  try {
    const [rawSongs, publicSongbooks] = await Promise.all([
      fetchSongsWithFavorites(db, userId),
      getPublicSongbooks(db)
    ]);

    // Convert raw database results to SongData instances
    const songs = SongData.fromDBArray(rawSongs);

    console.log(
      `Loaded ${songs.length} songs and ${publicSongbooks.length} public songbooks`
    );

    return c.json({
      status: "success",
      data: {
        songDB: songs.map(song => song.toJSON()),
        publicSongbooks,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    return c.json(
      {
        status: "error",
        message: "Failed to fetch songs and songbooks",
      },
      500
    );
  }
});

async function fetchSongsWithFavorites(db: DrizzleD1Database, userId?: string) {
  const songsData = await db
    .select({
      id: song.id,
      title: song.title,
      artist: song.artist,
      key: song.key,
      createdAt: song.createdAt,
      updatedAt: song.updatedAt,
      startMelody: song.startMelody,
      language: song.language,
      tempo: song.tempo,
      capo: song.capo,
      range: song.range,
      chordproURL: song.chordproURL,
      hidden: song.hidden,
      currentIllustration: {
        promptId: songIllustration.promptId,
        imageModel: songIllustration.imageModel,
        imageURL: songIllustration.imageURL,
        thumbnailURL: songIllustration.thumbnailURL,
      },
      isFavorite: userFavoriteSongs.userId,
    })
    .from(song)
    .leftJoin(
      songIllustration,
      and(
        eq(songIllustration.songId, song.id),
        eq(songIllustration.isActive, true)
      )
    )
    .leftJoin(
      userFavoriteSongs,
      userId
        ? and(
            eq(userFavoriteSongs.songId, song.id),
            eq(userFavoriteSongs.userId, userId)
          )
        : undefined
    )
    .where(eq(song.hidden, false));

  return songsData.map((song) => ({
    ...song,
    isFavorite: !!song.isFavorite,
  }));
}

async function getPublicSongbooks(db: DrizzleD1Database) {
  const result = await db
    .select({
      userId: user.id,
      userName: user.name,
      userNickname: user.nickname,
      userImage: user.image,
      songId: userFavoriteSongs.songId,
    })
    .from(user)
    .innerJoin(userFavoriteSongs, eq(user.id, userFavoriteSongs.userId))
    .where(eq(user.isFavoritesPublic, true))
    .orderBy(user.name, userFavoriteSongs.id);

  const userSongMap = new Map<
    string,
    {
      user: string;
      image: string;
      name: string;
      songIds: string[];
    }
  >();

  result.forEach((row) => {
    const userId = row.userId;

    if (!userSongMap.has(userId)) {
      userSongMap.set(userId, {
        user: userId,
        image: row.userImage || "",
        name: row.userNickname ?? row.userName,
        songIds: [],
      });
    }

    userSongMap.get(userId)!.songIds.push(row.songId);
  });

  return Array.from(userSongMap.values());
}

export default songDBRoutes;