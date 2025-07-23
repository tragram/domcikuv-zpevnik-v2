import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  songIllustration,
  userFavoriteSongs,
  user,
} from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildApp } from "./utils";

export const songDBRoutes = buildApp().get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("USER")?.id;

  try {
    // Get songs with illustrations and current user favorites
    const songs = await db
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
        currentIllustration: {
          promptId: songIllustration.promptId,
          promptModel: songIllustration.promptModel,
          imageModel: songIllustration.imageModel,
          imageURL: songIllustration.imageURL,
          thumbnailURL: songIllustration.thumbnailURL,
        },
        isFavoriteByCurrentUser: userFavoriteSongs.userId,
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
    const publicSongbooks = await getPublicSongbooks(db);

    // Process songs with favorites
    const songDB = songs.map((song) => ({
      ...song,
      isFavorite: !!song.isFavoriteByCurrentUser,
    }));

    console.log(
      `Loaded ${songDB.length} songs and ${publicSongbooks.length} public songbooks`
    );

    return c.json({
      status: "success",
      data: {
        songDB,
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
  console.log(result);
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
