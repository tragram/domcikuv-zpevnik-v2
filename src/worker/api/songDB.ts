import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  song,
  songIllustration,
  user,
  userFavoriteSongs,
} from "../../lib/db/schema";
import { buildApp } from "./utils";

export interface SongbookDataApi {
  user: string;
  image: string;
  name: string;
  songIds: string[];
}

export type SongDataApi = {
  id: string;
  title: string;
  artist: string;
  key: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  startMelody: string | null;
  language: string;
  tempo: number | null;
  capo: number;
  range: string | null;
  chordproURL: string;
  currentIllustration: {
    promptId: string;
    imageModel: string;
    imageURL: string;
    thumbnailURL: string;
  };
  isFavoriteByCurrentUser: boolean;
};

export const songDBRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;

    try {
      const baseSelectFields = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        createdAt: song.createdAt,
        updatedAt: song.updatedAt,
        startMelody: song.startMelody,
        language: song.language,
        tempo: song.tempo,
        capo: song.capo || 0,
        range: song.range,
        chordproURL: song.chordproURL,
        currentIllustration: {
          promptId: songIllustration.promptId,
          imageModel: songIllustration.imageModel,
          imageURL: songIllustration.imageURL,
          thumbnailURL: songIllustration.thumbnailURL,
        },
      };

      let songsRaw;

      if (userId) {
        // User is logged in - include favorites join and field
        songsRaw = await db
          .select({
            ...baseSelectFields,
            isFavoriteByCurrentUser: userFavoriteSongs.userId,
          })
          .from(song)
          .where(eq(song.hidden, false))
          .leftJoin(
            songIllustration,
            and(
              eq(songIllustration.songId, song.id),
              eq(songIllustration.isActive, true)
            )
          )
          .leftJoin(
            userFavoriteSongs,
            and(
              eq(userFavoriteSongs.songId, song.id),
              eq(userFavoriteSongs.userId, userId)
            )
          );
      } else {
        // No user logged in - exclude favorites entirely
        const rawResults = await db
          .select(baseSelectFields)
          .from(song)
          .where(eq(song.hidden, false))
          .leftJoin(
            songIllustration,
            and(
              eq(songIllustration.songId, song.id),
              eq(songIllustration.isActive, true)
            )
          );
        
        // Add the missing field with default value
        songsRaw = rawResults.map(song => ({
          ...song,
          isFavoriteByCurrentUser: null,
        }));
      }

      const songs = songsRaw.map((song) => ({
        ...song,
        isFavoriteByCurrentUser: !!song.isFavoriteByCurrentUser,
      }));
      
      return c.json({
        status: "success",
        data: songs as SongDataApi[],
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
  })

  .get("/songbooks", async (c) => {
    const db = drizzle(c.env.DB);
    // TODO: perhaps ignore self-songbook?
    try {
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

      return c.json({
        status: "success",
        data: Array.from(userSongMap.values()) as SongbookDataApi[],
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
export default songDBRoutes;