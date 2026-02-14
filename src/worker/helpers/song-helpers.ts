import {
  and,
  eq,
  gte,
  or,
  isNotNull,
  getTableColumns,
  desc,
} from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  SongDataDB,
  songIllustration,
  SongIllustrationDB,
  songImport,
  SongImportDB,
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
  externalSource: string;
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
  externalSource: SongImportDB["source"];
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
  songImport: songImport,

  // Current illustration fields
  currentIllustration: {
    illustrationId: songIllustration.id,
    promptId: songIllustration.promptId,
    imageModel: songIllustration.imageModel,
    imageURL: songIllustration.imageURL,
    thumbnailURL: songIllustration.thumbnailURL,
  },
};

const transformSongToApi = (
  songItem: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    hidden: boolean;
    deleted: boolean;
    title: string | null;
    artist: string | null;
    key: string | null;
    startMelody: string | null;
    language: string | null;
    tempo: string | null;
    capo: number | null;
    range: string | null;
    chordpro: string | null;
    songImport: SongImportDB | null;
    currentIllustration: {
      illustrationId: string | null;
      promptId: string | null;
      imageModel: string | null;
      imageURL: string | null;
      thumbnailURL: string | null;
    } | null;
  },
  updatedSince?: Date,
): SongDataApi => ({
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
  externalSource: songItem.songImport?.source ?? null,
  chordpro: songItem.chordpro ?? "Not uploaded",
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
});

export async function retrieveSongs(
  db: DrizzleD1Database,
  userId?: string,
  updatedSince?: Date,
  includeHidden = false,
  includeDeleted = false,
) {
  // Build conditions first
  const conditions = [isNotNull(song.currentVersionId)];

  if (!includeHidden) {
    if (includeDeleted) {
      // the or condition can return undefined sometimes, so this is for TS
      const orCondition = or(eq(song.hidden, false), eq(song.deleted, true));
      if (orCondition) {
        conditions.push(orCondition);
      }
    } else {
      conditions.push(eq(song.hidden, false));
    }
  }

  if (!includeDeleted) {
    conditions.push(eq(song.deleted, false));
  }

  if (updatedSince) {
    conditions.push(gte(song.updatedAt, updatedSince));
  }

  // Build query with all conditions at once
  let query = db
    .select({
      ...baseSelectFields,
    })
    .from(song)
    .where(and(...conditions))
    .leftJoin(songVersion, eq(songVersion.id, song.currentVersionId))
    .leftJoin(songImport, eq(songImport.id, songVersion.importId))
    .leftJoin(
      songIllustration,
      eq(songIllustration.id, song.currentIllustrationId),
    );

  // Add favorites join if userId is provided
  if (userId) {
    query = query.leftJoin(
      userFavoriteSongs,
      and(
        eq(userFavoriteSongs.songId, song.id),
        eq(userFavoriteSongs.userId, userId),
      ),
    );
  }

  const songsRaw = await query;
  return songsRaw.map((songItem) => transformSongToApi(songItem, updatedSince));
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

export const retrieveSingleSong = async (
  db: DrizzleD1Database,
  songId: string,
  versionId?: string,
): Promise<SongDataApi | null> => {
  const songsRaw = await db
    .select({
      ...baseSelectFields,
    })
    .from(song)
    .leftJoin(songVersion, eq(songVersion.songId, songId))
    .leftJoin(
      songIllustration,
      eq(songIllustration.id, song.currentIllustrationId),
    )
    .leftJoin(songImport, eq(songImport.id, songVersion.importId))
    .where(
      and(
        eq(song.id, songId),
        versionId ? eq(songVersion.id, versionId) : undefined,
      ),
    )
    .limit(1);

  if (songsRaw.length === 0) {
    return null;
  }

  return transformSongToApi(songsRaw[0]);
};

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
        externalSource: songImport.source,
        id: song.id,
      })
      .from(song)
      .innerJoin(songVersion, eq(songVersion.id, song.currentVersionId))
      .leftJoin(songImport, eq(songImport.id, songVersion.importId))
      .where(eq(song.id, songId))
      .limit(1)) as SongWithCurrentVersion[];
  } else {
    songResults = (await db
      .select()
      .from(song)
      .where(eq(song.id, songId))
      .limit(1)) as SongDataDB[];
  }
  console.log(songResults);
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
  importId?: string,
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
      // newly added songs by untrusted users don't have to be hidden via this - they won't have currentVersionId and thus won't be shown automatically
      // hidden: !isTrusted,
      currentVersionId: null,
    });
  }

  const newVersion = await createSongVersion(
    db,
    submission,
    songId,
    userId,
    isTrusted,
    importId,
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
  importId?: string,
) => {
  const now = new Date();
  let parentVersion: SongVersionDB | undefined = undefined;
  // ensure parentId is valid
  if (submission.parentId) {
    const parentVersionResult = await db
      .select()
      .from(songVersion)
      .where(eq(songVersion.id, submission.parentId))
      .limit(1);
    if (
      parentVersionResult.length === 0 ||
      parentVersionResult[0].songId !== songId
    ) {
      throw Error("Invalid parentId!");
    }
    parentVersion = parentVersionResult[0];
  }
  // check if the parent id is pending - in that case we edit that one
  // LOGIC BRANCH A: Update existing pending draft
  if (parentVersion && parentVersion.status === "pending") {
    // If the user is trusted, their update acts as an "Approval" of their own draft immediately
    const shouldPublish = isTrusted;

    const updatedVersion = await db
      .update(songVersion)
      .set({
        ...submission,
        updatedAt: now,
        approvedBy: shouldPublish ? userId : null,
        approvedAt: shouldPublish ? now : null,
        importId: importId ?? null,
      })
      .where(eq(songVersion.id, parentVersion.id))
      .returning();
    // If we just published this, update the main Song pointer and archive the old parent
    if (shouldPublish) {
      await promoteVersionToCurrent(db, songId, parentVersion.id, userId);
    }

    return updatedVersion[0];
  }

  // LOGIC BRANCH B: Create new version (Fork from current)
  else {
    const versionId = songId + "_" + now.getTime();
    const shouldPublish = isTrusted;

    const newVersion = await db
      .insert(songVersion)
      .values({
        ...submission,
        id: versionId,
        songId: songId,
        parentId: submission.parentId,
        userId: userId,
        approvedBy: shouldPublish ? userId : null,
        approvedAt: shouldPublish ? now : null,
        createdAt: now,
        updatedAt: now,
        importId: importId ?? null,
      })
      .returning();

    if (shouldPublish) {
      await promoteVersionToCurrent(db, songId, versionId, userId);
    }

    return newVersion[0];
  }
};

export const promoteVersionToCurrent = async (
  db: DrizzleD1Database,
  songId: string,
  versionId: string,
  approverId: string,
) => {
  const now = new Date();

  // 1. Get the current active version to archive it
  const currentSong = await db
    .select({ currentVersionId: song.currentVersionId })
    .from(song)
    .where(eq(song.id, songId))
    .get();

  // 2. Archive the OLD current version (if it exists and is different)
  if (
    currentSong?.currentVersionId &&
    currentSong.currentVersionId !== versionId
  ) {
    await db
      .update(songVersion)
      .set({ status: "archived" })
      .where(eq(songVersion.id, currentSong.currentVersionId));
  }

  // 3. Publish the NEW version
  await db
    .update(songVersion)
    .set({
      status: "published",
      approvedBy: approverId,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(songVersion.id, versionId));

  // 4. Update the Song pointer
  await db
    .update(song)
    .set({
      currentVersionId: versionId,
      updatedAt: now,
    })
    .where(eq(song.id, songId));
};

export const createImportSong = async (
  db: DrizzleD1Database,
  title: string,
  artist: string,
  originalContent: string,
  url: string,
  userId: string,
  source: SongImportDB["source"],
) => {
  const importId = SongData.baseId(title, artist);
  const importedSong = await db.insert(songImport).values({
    id: importId,
    title: title,
    artist: artist,
    source: source,
    originalContent: originalContent,
    url: url,
    userId: userId,
  });
  return importId;
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
