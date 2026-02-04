import {
  and,
  eq,
  gte,
  or,
  isNotNull,
  getTableColumns,
  desc,
  sql,
} from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  SongDataDB,
  songIllustration,
  SongIllustrationDB,
  songVersion,
  SongVersionDB,
  user,
  userFavoriteSongs,
} from "src/lib/db/schema";
import { EditorSubmitSchema } from "../api/editor";
import { SongData } from "src/web/types/songData";

export type SongWithCurrentVersion = SongDataDB & {
  title: string;
  artist: string;
  key: string | null;
  startMelody: string | null;
  language: string;
  tempo: string | null;
  capo: number | null;
  range: string | null;
  chordpro: string;
};

export type SongWithDataDB = SongDataDB & {
  currentVersion?: SongVersionDB;
  versions: SongVersionDB[];
  currentIllustration?: SongIllustrationDB;
  illustrations: SongIllustrationDB[];
};

export type SongbookDataApi = {
  user: string;
  image: string;
  name: string;
  songIds: string[];
};

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
        illustrationId: string;
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

export const baseSelectFields = {
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
    illustrationId: songIllustration.id,
    promptId: songIllustration.promptId,
    imageModel: songIllustration.imageModel,
    imageURL: songIllustration.imageURL,
    thumbnailURL: songIllustration.thumbnailURL,
  },
};

export async function retrieveSongs(
  db: DrizzleD1Database,
  userId?: string,
  updatedSince?: Date,
  includeHidden = false,
  includeDeleted = false,
) {
  let query = db
    .select({
      ...baseSelectFields,
      isFavoriteByCurrentUser: userId
        ? userFavoriteSongs.userId
        : sql<string | null>`NULL`,
    })
    .from(song)
    .leftJoin(songVersion, eq(songVersion.id, song.currentVersionId))
    .leftJoin(
      songIllustration,
      eq(songIllustration.id, song.currentIllustrationId),
    );

  // Add the userFavoriteSongs join conditionally
  if (userId) {
    query = query.leftJoin(
      userFavoriteSongs,
      and(
        eq(userFavoriteSongs.songId, song.id),
        eq(userFavoriteSongs.userId, userId),
      ),
    );
  }

  // Build conditions
  const conditions = [];
  if (!includeHidden) {
    if (includeDeleted) {
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

  // Apply where conditions if any exist
  const finalQuery =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  const songsRaw = await finalQuery;

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
      isFavoriteByCurrentUser: !!(
        songItem as { isFavoriteByCurrentUser?: string | null }
      ).isFavoriteByCurrentUser,
      currentIllustration:
        songItem.currentIllustration?.illustrationId &&
        songItem.currentIllustration?.promptId &&
        songItem.currentIllustration?.imageModel &&
        songItem.currentIllustration?.imageURL &&
        songItem.currentIllustration?.thumbnailURL
          ? {
              illustrationId: songItem.currentIllustration.illustrationId,
              promptId: songItem.currentIllustration.promptId,
              imageModel: songItem.currentIllustration.imageModel,
              imageURL: songItem.currentIllustration.imageURL,
              thumbnailURL: songItem.currentIllustration.thumbnailURL,
              // TODO: this is not true anymore...
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
    }),
  );
}

export async function getSongbooks(db: DrizzleD1Database) {
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

  const userSongbooks = new Map<
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

    if (!userSongbooks.has(userId)) {
      userSongbooks.set(userId, {
        user: userId,
        image: row.userImage || "",
        name: row.userNickname ?? row.userName,
        songIds: [],
      });
    }

    userSongbooks.get(userId)!.songIds.push(row.songId);
  });

  return Array.from(userSongbooks.values()) as SongbookDataApi[];
}

export const findSong = async (
  db: DrizzleD1Database,
  songId: string,
  withVersion = true,
): Promise<SongWithCurrentVersion | SongDataDB> => {
  let songResults: SongWithCurrentVersion[] | SongDataDB[];
  if (withVersion) {
    songResults = (await db
      .select({
        ...getTableColumns(song),
        ...getTableColumns(songVersion),
        id: song.id,
      })
      .from(song)
      .innerJoin(songVersion, eq(songVersion.id, song.currentVersionId))
      .where(eq(song.id, songId))
      .limit(1)) as SongWithCurrentVersion[];
  } else {
    songResults = (await db
      .select()
      .from(song)
      .where(eq(song.id, songId))
      .limit(1)) as SongDataDB[];
  }
  if (songResults.length === 0) {
    throw new Error("Referenced song not found!");
  }
  return songResults[0];
};

export const createSong = async (
  db: DrizzleD1Database,
  submission: EditorSubmitSchema,
  userId: string,
  isTrusted: boolean,
  sourceId: string = "editor",
) => {
  const now = new Date();
  // assume 1-to-1 relation between songs and IDs
  const songId = SongData.baseId(submission.title, submission.artist);
  const existingSong = await db
    .select()
    .from(song)
    .where(eq(song.id, songId))
    .limit(1);
  if (existingSong.length === 0) {
    // create song if it does not exist
    await db.insert(song).values({
      id: songId,
      createdAt: now,
      updatedAt: now,
      hidden: !isTrusted,
      currentVersionId: null,
    });
  }

  const newVersion = await createSongVersion(
    db,
    submission,
    songId,
    userId,
    isTrusted,
    sourceId,
  );

  const newSong = await db.select().from(song).where(eq(song.id, songId));

  return { newSong: newSong[0], newVersion: newVersion };
};

export const createSongVersion = async (
  db: DrizzleD1Database,
  submission: EditorSubmitSchema,
  songId: string,
  userId: string,
  isTrusted: boolean,
  sourceId: string = "editor",
) => {
  const now = new Date();

  // only allowing one song version per user - TODO: this is ugly and random
  const userVersionResult = await db
    .select()
    .from(songVersion)
    .where(and(eq(songVersion.songId, songId), eq(songVersion.userId, userId)))
    .limit(1);

  if (userVersionResult.length > 0) {
    const existingVersion = userVersionResult[0];
    const updatedVersion = await db
      .update(songVersion)
      .set({
        ...submission,
        updatedAt: now,
        approved: isTrusted,
        approvedBy: isTrusted ? userId : null,
        approvedAt: isTrusted ? now : null,
        sourceId: sourceId,
      })
      .where(eq(songVersion.id, existingVersion.id))
      .returning();

    if (isTrusted) {
      await db
        .update(song)
        .set({ currentVersionId: existingVersion.id, updatedAt: now })
        .where(eq(song.id, songId));
    }
    return updatedVersion[0];
  } else {
    const versionId = songId + "_" + now.getTime();
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
        sourceId: sourceId,
        approvedBy: isTrusted ? userId : null,
        approvedAt: isTrusted ? now : null,
      })
      .returning();
    if (isTrusted) {
      await db
        .update(song)
        .set({ currentVersionId: versionId, updatedAt: now })
        .where(eq(song.id, songId));
    }
    return newVersion[0];
  }
};

export const findSongWithVersions = async (
  db: DrizzleD1Database,
  songId: string,
): Promise<SongWithDataDB> => {
  const songData = (await findSong(db, songId)) as SongDataDB;

  // Get all versions for this song
  const versions = await db
    .select()
    .from(songVersion)
    .where(eq(songVersion.songId, songId))
    .orderBy(desc(songVersion.createdAt));

  // Get all illustrations for this song
  const illustrations = await db
    .select()
    .from(songIllustration)
    .where(eq(songIllustration.songId, songId))
    .orderBy(desc(songIllustration.createdAt));

  // Get current version if exists
  let currentVersion;
  if (songData.currentVersionId) {
    const currentVersionResult = await db
      .select()
      .from(songVersion)
      .where(eq(songVersion.id, songData.currentVersionId))
      .limit(1);
    currentVersion = currentVersionResult[0] || undefined;
  }

  // Get current illustration if exists
  let currentIllustration;
  if (songData.currentIllustrationId) {
    const currentIllustrationResult = await db
      .select()
      .from(songIllustration)
      .where(eq(songIllustration.id, songData.currentIllustrationId))
      .limit(1);
    currentIllustration = currentIllustrationResult[0] || undefined;
  }

  return {
    ...songData,
    currentVersion,
    currentIllustration,
    versions,
    illustrations,
  };
};

export const getSongVersionsByUser = async (
  db: DrizzleD1Database,
  userId: string,
) => {
  const versions = await db
    .select()
    .from(songVersion)
    .where(eq(songVersion.userId, userId))
    .orderBy(desc(songVersion.createdAt));

  return versions;
};

export const deleteSongVersion = async (
  db: DrizzleD1Database,
  versionId: string,
  userId: string,
) => {
  const version = await db
    .select()
    .from(songVersion)
    .where(eq(songVersion.id, versionId))
    .limit(1);

  if (version.length === 0) {
    throw new Error("Version not found");
  }

  if (version[0].userId !== userId) {
    throw new Error("You are not authorized to delete this version");
  }

  if (version[0].approved) {
    throw new Error("You cannot delete an approved version");
  }

  await db.delete(songVersion).where(eq(songVersion.id, versionId));
};
