import {
  and,
  BuildQueryResult,
  desc,
  eq,
  ExtractTablesWithRelations,
  gte,
  isNotNull,
  or,
} from "drizzle-orm";
import * as schema from "src/lib/db/schema";
import {
  song,
  SongDataDB,
  songIllustration,
  songImport,
  SongImportDB,
  songVersion,
  user,
  userFavoriteSongs,
} from "src/lib/db/schema";
import { SongData } from "src/web/types/songData";
import { EditorSubmitSchema } from "../api/editor";
import { AppDatabase } from "../api/utils";
import { SongbookDataApi, SongDataApi } from "../api/api-types";

type TSchema = ExtractTablesWithRelations<typeof schema>;

export type PopulatedSongDB = BuildQueryResult<
  TSchema,
  TSchema["song"],
  {
    with: {
      currentVersion: { with: { songImport: true } };
      currentIllustration: true;
    };
  }
>;
// --- DTO Mapper ---
const transformSongToApi = (
  songItem: PopulatedSongDB & { favorites?: { userId: string }[] },
  userId?: string,
  updatedSince?: Date,
): SongDataApi => {
  const version = songItem.currentVersion;

  return {
    id: songItem.id,
    title: version?.title ?? "Unknown title",
    artist: version?.artist ?? "Unknown artist",
    key: version?.key ?? undefined,
    createdAt: songItem.createdAt,
    updatedAt: songItem.updatedAt,
    startMelody: version?.startMelody ?? undefined,
    language: version?.language ?? "unknown",
    tempo: version?.tempo ? parseInt(version.tempo) : undefined,
    capo: version?.capo ?? undefined,
    range: version?.range ?? undefined,
    chordpro: version?.chordpro ?? "Not uploaded",

    // Use optional chaining safely down the tree
    externalSource: version?.songImport
      ? {
          sourceId: version.songImport.sourceId,
          originalContent: version.songImport.originalContent,
          url: version.songImport.url,
        }
      : null,

    currentIllustration: songItem.currentIllustration
      ? {
          illustrationId: songItem.currentIllustration.id,
          promptId: songItem.currentIllustration.promptId,
          imageModel: songItem.currentIllustration.imageModel,
          imageURL: songItem.currentIllustration.imageURL,
          thumbnailURL: songItem.currentIllustration.thumbnailURL,
          promptURL: `/songs/image_prompts/${songItem.id}.yaml`,
        }
      : undefined,

    isFavoriteByCurrentUser:
      !!userId && !!songItem.favorites?.some((fav) => fav.userId === userId),

    updateStatus: updatedSince
      ? songItem.deleted
        ? "deleted"
        : new Date(songItem.createdAt) >= updatedSince
          ? "added"
          : "modified"
      : undefined,
  };
};

// --- Data Fetchers ---

export async function retrieveSongs(
  db: AppDatabase,
  userId?: string,
  updatedSince?: Date,
  includeHidden = false,
  includeDeleted = false,
) {
  const conditions = [isNotNull(song.currentVersionId)];

  if (!includeHidden) {
    if (includeDeleted)
      conditions.push(or(eq(song.hidden, false), eq(song.deleted, true))!);
    else conditions.push(eq(song.hidden, false));
  }
  if (!includeDeleted) conditions.push(eq(song.deleted, false));
  if (updatedSince) conditions.push(gte(song.updatedAt, updatedSince));

  const songsRaw = await db.query.song.findMany({
    where: and(...conditions),
    with: {
      currentVersion: {
        with: { songImport: true },
      },
      currentIllustration: true,
      // Only pull favorites if a user is logged in to check against
      ...(userId && {
        favorites: { where: eq(userFavoriteSongs.userId, userId), limit: 1 },
      }),
    },
  });

  return songsRaw.map((s) => transformSongToApi(s, userId, updatedSince));
}

export const retrieveSingleSong = async (
  db: AppDatabase,
  songId: string,
  versionId?: string,
  userId?: string,
): Promise<SongDataApi | null> => {
  const songRaw = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      // If versionId is provided, we still fetch the specific requested version.
      // If you strictly want *only* that version, you might need a separate query,
      // but assuming currentVersion maps well here:
      currentVersion: {
        with: { songImport: true },
      },
      currentIllustration: true,
      ...(userId && {
        favorites: { where: eq(userFavoriteSongs.userId, userId), limit: 1 },
      }),
    },
  });

  if (!songRaw) return null;

  // If a specific version is requested, override currentVersion data (Optional optimization)
  if (versionId && songRaw.currentVersion?.id !== versionId) {
    const specificVersion = await db.query.songVersion.findFirst({
      where: eq(songVersion.id, versionId),
      with: { songImport: true },
    });
    if (specificVersion) {
      songRaw.currentVersion = specificVersion;
    }
  }

  return transformSongToApi(songRaw, userId);
};

export const getSongBase = async (
  db: AppDatabase,
  songId: string,
): Promise<SongDataDB> => {
  const result = await db.query.song.findFirst({ where: eq(song.id, songId) });
  if (!result) throw new Error("Song not found");
  return result;
};

export const getSongPopulated = async (db: AppDatabase, songId: string) => {
  const result = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      currentVersion: { with: { songImport: true } },
      currentIllustration: true,
    },
  });
  if (!result) throw new Error("Song not found");
  return result;
};

export const findSongWithAllData = async (db: AppDatabase, songId: string) => {
  const completeSong = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      currentVersion: { with: { songImport: true } },
      currentIllustration: true,
      version: { orderBy: [desc(songVersion.createdAt)] },
      illustration: { orderBy: [desc(songIllustration.createdAt)] },
    },
  });

  if (!completeSong) throw new Error("Referenced song not found!");
  return completeSong;
};

export async function getSongbooks(db: AppDatabase) {
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

  const userSongbooks = new Map<string, SongbookDataApi>();

  result.forEach((row) => {
    if (!userSongbooks.has(row.userId)) {
      userSongbooks.set(row.userId, {
        user: row.userId,
        image: row.userImage || "",
        name: row.userNickname ?? row.userName,
        songIds: [],
      });
    }
    userSongbooks.get(row.userId)!.songIds.push(row.songId);
  });

  return Array.from(userSongbooks.values());
}

export const getSongVersionsByUser = async (
  db: AppDatabase,
  userId: string,
) => {
  return await db.query.songVersion.findMany({
    where: eq(songVersion.userId, userId),
    orderBy: [desc(songVersion.createdAt)],
  });
};

// --- Mutations ---

export const createSong = async (
  db: AppDatabase,
  submission: EditorSubmitSchema,
  userId: string,
  isTrusted: boolean,
  importId?: string,
) => {
  const now = new Date();
  const songId = SongData.baseId(submission.title, submission.artist);

  const existingSong = await getSongBase(db, songId).catch(() => null);

  if (!existingSong) {
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
  const newSong = await getSongBase(db, songId);

  return { newSong, newVersion };
};

export const createSongVersion = async (
  db: AppDatabase,
  submission: EditorSubmitSchema,
  songId: string,
  userId: string,
  isTrusted: boolean,
  importId?: string,
) => {
  const now = new Date();
  let parentVersion: schema.SongVersionDB | undefined = undefined;

  if (submission.parentId) {
    parentVersion = await db.query.songVersion.findFirst({
      where: eq(songVersion.id, submission.parentId),
    });
    if (!parentVersion || parentVersion.songId !== songId) {
      throw Error("Invalid parentId!");
    }
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

    if (shouldPublish)
      await promoteVersionToCurrent(db, songId, parentVersion.id, userId);
    return updatedVersion[0];
  } else {
    // LOGIC BRANCH B: Create new version (Fork from current)
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

    if (shouldPublish)
      await promoteVersionToCurrent(db, songId, versionId, userId);
    return newVersion[0];
  }
};

export const promoteVersionToCurrent = async (
  db: AppDatabase,
  songId: string,
  versionId: string,
  approverId: string,
) => {
  const now = new Date();
  const currentSong = await getSongBase(db, songId);
  //Archive the OLD current version (if it exists and is different)
  if (
    currentSong.currentVersionId &&
    currentSong.currentVersionId !== versionId
  ) {
    await db
      .update(songVersion)
      .set({ status: "archived" })
      .where(eq(songVersion.id, currentSong.currentVersionId));
  }

  await db
    .update(songVersion)
    .set({
      status: "published",
      approvedBy: approverId,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(songVersion.id, versionId));

  await db
    .update(song)
    .set({ currentVersionId: versionId, updatedAt: now })
    .where(eq(song.id, songId));
};

export const songImportId = (
  sourceId: SongImportDB["sourceId"],
  title: string,
  artist: string,
) => `${sourceId}/${SongData.baseId(title, artist)}_${Date.now()}`;

export const createImportSong = async (
  db: AppDatabase,
  title: string,
  artist: string,
  originalContent: string,
  url: string,
  userId: string,
  sourceId: SongImportDB["sourceId"],
) => {
  const importedSong = await db
    .insert(songImport)
    .values({
      id: songImportId(sourceId, title, artist),
      title,
      artist,
      sourceId,
      originalContent,
      url,
      userId,
    })
    .returning();
  return importedSong[0];
};
