import { and, eq, gte, or, isNotNull } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  songIllustration,
  songVersion,
  user,
  userFavoriteSongs,
} from "../../lib/db/schema";
import { buildApp } from "./utils";
import { z } from "zod/v4";
import { zValidator } from "@hono/zod-validator";

// Change to query parameters for GET request
const incrementalUpdateSchema = z.object({
  songDBVersion: z.string(),
  lastUpdateAt: z.string().transform((str) => new Date(str)),
});

export interface SongbookDataAwpi {
  user: string;
  image: string;
  name: string;
  songIds: string[];
}

export type SongDataApi = {
  id: string;
  title: string;
  artist: string;
  key: string | undefined;
  createdAt: string | Date;
  updatedAt: string | Date;
  startMelody: string | undefined;
  language: string;
  tempo: number | undefined;
  capo: number | undefined;
  range: string | undefined;
  chordpro: string;
  currentIllustration:
    | {
        imageModel: string;
        imageURL: string;
        thumbnailURL: string;
        promptId: string;
        promptURL: string;
      }
    | undefined;
  isFavoriteByCurrentUser: boolean;
  // incremental update status
  updateStatus?: "added" | "modified" | "deleted";
};

export type SongDBResponseData = {
  songs: SongDataApi[];
  songDBVersion: string;
  lastUpdateAt: string;
  isIncremental: boolean;
};

async function retrieveSongs(
  db: DrizzleD1Database,
  userId?: string,
  updatedSince?: Date,
  includeHidden = false,
  includeDeleted = false
) {
  const baseSelectFields = {
    // Song table fields
    id: song.id,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    hidden: song.hidden,
    deleted: song.deleted,

    // Current version fields (song metadata)
    title: songVersion.title,
    artist: songVersion.artist,
    key: songVersion.key,
    startMelody: songVersion.startMelody,
    language: songVersion.language,
    tempo: songVersion.tempo,
    capo: songVersion.capo,
    range: songVersion.range,
    chordpro: songVersion.chordpro,

    // Current illustration fields
    currentIllustration: {
      promptId: songIllustration.promptId,
      imageModel: songIllustration.imageModel,
      imageURL: songIllustration.imageURL,
      thumbnailURL: songIllustration.thumbnailURL,
    },
  };

  let query;
  if (userId) {
    query = db
      .select({
        ...baseSelectFields,
        isFavoriteByCurrentUser: userFavoriteSongs.userId,
      })
      .from(song)
      // Join with current version to get song metadata
      .leftJoin(songVersion, eq(songVersion.id, song.currentVersionId))
      // Join with current illustration
      .leftJoin(
        songIllustration,
        eq(songIllustration.id, song.currentIllustrationId)
      )
      // Join with user favorites
      .leftJoin(
        userFavoriteSongs,
        and(
          eq(userFavoriteSongs.songId, song.id),
          eq(userFavoriteSongs.userId, userId)
        )
      );
  } else {
    query = db
      .select(baseSelectFields)
      .from(song)
      // Join with current version to get song metadata
      .leftJoin(songVersion, eq(songVersion.id, song.currentVersionId))
      // Join with current illustration
      .leftJoin(
        songIllustration,
        eq(songIllustration.id, song.currentIllustrationId)
      );
  }

  // add .where conditions based on params
  const conditions = [];
  if (!includeHidden) {
    if (includeDeleted) {
      // deleted songs need to be shown regardless of hidden state so SW cache can be properly updated
      conditions.push(or(eq(song.hidden, false), eq(song.deleted, true)));
    } else {
      conditions.push(eq(song.hidden, false));
    }
  }

  if (!includeDeleted) {
    conditions.push(eq(song.deleted, false));
    conditions.push(isNotNull(song.currentVersionId));
  }

  if (updatedSince) {
    conditions.push(gte(song.updatedAt, updatedSince));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const songsRaw = await query;
  return songsRaw.map(
    (songItem): SongDataApi => ({
      id: songItem.id,
      title: songItem.title ?? "Unknown title",
      artist: songItem.artist ?? "Unknown artist",
      key: songItem.key ?? "",
      createdAt: songItem.createdAt,
      updatedAt: songItem.updatedAt,
      startMelody: songItem.startMelody ?? undefined,
      language: songItem.language ?? "unknown",
      tempo: songItem.tempo ? parseInt(songItem.tempo) : undefined,
      capo: songItem.capo ?? undefined,
      range: songItem.range ?? undefined,
      chordpro: songItem.chordpro ?? "Not uploaded",
      // Convert userId presence to boolean
      isFavoriteByCurrentUser: !!(songItem as any).isFavoriteByCurrentUser,
      currentIllustration:
        songItem.currentIllustration?.promptId &&
        songItem.currentIllustration?.imageModel &&
        songItem.currentIllustration?.imageURL &&
        songItem.currentIllustration?.thumbnailURL
          ? {
              promptId: songItem.currentIllustration.promptId,
              imageModel: songItem.currentIllustration.imageModel,
              imageURL: songItem.currentIllustration.imageURL,
              thumbnailURL: songItem.currentIllustration.thumbnailURL,
              promptURL: `/songs/image_prompts/${songItem.id}.yaml`,
            }
          : undefined,
      updateStatus: updatedSince
        ? songItem.deleted
          ? "deleted"
          : new Date(songItem.createdAt) >= updatedSince
          ? "added"
          : "modified"
        : undefined,
    })
  );
}

export const songDBRoutes = buildApp()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;

    try {
      const songs = await retrieveSongs(db, userId);

      return c.json({
        status: "success",
        data: {
          songs,
          songDBVersion: await c.env.KV.get("songDB-version"),
          lastUpdateAt: Date.now().toString(),
          isIncremental: false,
        } as SongDBResponseData,
      });
    } catch (error) {
      console.error("Database error:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch songs",
        },
        500
      );
    }
  })

  // Changed to use query parameters instead of JSON body
  .get(
    "/incremental",
    zValidator("query", incrementalUpdateSchema),
    async (c) => {
      const { lastUpdateAt, songDBVersion } = c.req.valid("query");
      const db = drizzle(c.env.DB);
      const userId = c.get("USER")?.id;
      let songs;
      let isIncremental;

      const currentDBVersion = await c.env.KV.get("songDB-version");

      if (songDBVersion !== currentDBVersion) {
        // Full refresh needed
        songs = await retrieveSongs(db, userId);
        isIncremental = false;
      } else {
        // Incremental update
        songs = await retrieveSongs(db, userId, lastUpdateAt, true, true);
        isIncremental = true;
      }

      return c.json({
        status: "success",
        data: {
          songs,
          songDBVersion: currentDBVersion,
          lastUpdateAt: Date.now().toString(),
          isIncremental: isIncremental,
        } as SongDBResponseData,
      });
    }
  )

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
