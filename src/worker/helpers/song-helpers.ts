import { versionNumbers } from "./song-versions/numbering";
import { importVersionIdsWithSheetChanges } from "./song-versions/revisions";
import { withSubmission } from "src/lib/song-submission";
import {
  and,
  asc,
  ne,
  BuildQueryResult,
  desc,
  eq,
  ExtractTablesWithRelations,
  gte,
  inArray,
  isNull,
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
  SongVersionDB,
  user,
  userFavoriteSongs,
} from "src/lib/db/schema";
import { songBaseId } from "src/lib/song-ids";
import type { EditorSubmitSchema } from "src/lib/contracts/editor-schema";
import { saveSongVersion as createSongVersion } from "./song-versions/writes";
import { AppDatabase } from "../api/utils";
import { SongbookDataApi, SongDataApi } from "../api/api-types";

type TSchema = ExtractTablesWithRelations<typeof schema>;

export type PopulatedSongDB = BuildQueryResult<
  TSchema,
  TSchema["song"],
  {
    with: {
      currentVersion: { with: { songImport: true, submission: true } };
      currentIllustration: true;
    };
  }
>;
// Attribute a displayed alternative without inferring its official status.
const customMetaOf = (
  canonical: { id: string; createdAt: Date | string } | null | undefined,
  shown:
    | {
        id: string;
        createdAt: Date | string;
        user?: { id: string; name: string; nickname?: string | null } | null;
      }
    | null
    | undefined,
): Pick<SongDataApi, "versionAuthor"> => {
  if (!shown || (canonical && shown.id === canonical.id)) return {};
  return {
    versionAuthor: shown.user
      ? { id: shown.user.id, name: shown.user.nickname ?? shown.user.name }
      : undefined,
  };
};

// Ship actual choices with the offline catalog; never estimate them in the UI.
export async function publishedVersionIds(db: AppDatabase, songIds?: string[]) {
  const ids = new Map<string, string[]>();
  // D1 allows 100 parameters; reserve one for the published status.
  const batches: (string[] | undefined)[] = songIds === undefined ? [undefined] : [];
  const uniqueIds = [...new Set(songIds)];
  for (let i = 0; i < uniqueIds.length; i += 99) {
    batches.push(uniqueIds.slice(i, i + 99));
  }
  for (const batch of batches) {
    const rows = await db.select({ songId: songVersion.songId, id: songVersion.id })
      .from(songVersion)
      .where(and(eq(songVersion.status, "published"), isNull(songVersion.mergedIntoVersionId), batch ? inArray(songVersion.songId, batch) : undefined));
    for (const row of rows) {
      const versions = ids.get(row.songId) ?? [];
      versions.push(row.id);
      ids.set(row.songId, versions);
    }
  }
  return ids;
}

// --- DTO Mapper ---
const transformSongToApi = (
  songItem: PopulatedSongDB & { favorites?: { userId: string }[] },
  editedImportVersionIds: ReadonlySet<string>,
  updatedSince?: Date,
): SongDataApi => {
  const version = songItem.currentVersion;
  const sheetChangedSinceImport = !!version && editedImportVersionIds.has(version.id);

  return {
    id: songItem.id,
    versionId: version?.id,
    versionStatus: version?.status,
    versionRevision: version?.revision,
    versionLabel: version?.label,
    versionDescription: version?.description,
    versionAuthorId: version?.userId,
    versionParentId: version?.parentId,
    versionCreatedAt: version?.createdAt,
    versionUpdatedAt: version?.updatedAt,
    isOfficial: version?.id === songItem.currentVersionId,
    submissionIntent: version?.submission?.submissionIntent,
    baseRevision: version?.submission?.baseRevision,
    archivePreviousOnPublish: version?.submission?.archivePreviousOnPublish,
    makeOfficialOnPublish: version?.submission?.makeOfficialOnPublish,
    officialVersionId: songItem.currentVersionId,
    title: version?.title ?? "Unknown title",
    artist: version?.artist ?? "Unknown artist",
    key: version?.key ?? undefined,
    createdAt: songItem.createdAt,
    updatedAt: songItem.updatedAt,
    startMelody: version?.startMelody ?? undefined,
    language: version?.language ?? undefined,
    tempo: version?.tempo ? parseInt(version.tempo) : undefined,
    capo: version?.capo ?? undefined,
    range: version?.range ?? undefined,
    youtubeId: version?.youtubeId ?? undefined,
    chordpro: version?.chordpro ?? "Not uploaded",

    importOriginalContent: sheetChangedSinceImport ? version?.songImport?.originalContent : undefined,
    externalSource: !sheetChangedSinceImport && version?.songImport
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

    updateStatus: updatedSince
      ? songItem.deleted || !version
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
  updatedSince?: Date,
  includeDeleted = false,
) {
  const conditions = [];
  if (!includeDeleted) conditions.push(eq(song.deleted, false));

  if (updatedSince) {
    conditions.push(
      or(
        gte(song.updatedAt, updatedSince),
        inArray(
          song.currentIllustrationId,
          db
            .select({ id: songIllustration.id })
            .from(songIllustration)
            .where(gte(songIllustration.updatedAt, updatedSince)),
        ),
      )!,
    );
  }

  const rows = await db.query.song.findMany({
    where: and(...conditions),
    with: {
      currentVersion: { with: { songImport: true, submission: true } },
      version: {
        where: and(eq(songVersion.status, "published"), isNull(songVersion.mergedIntoVersionId)),
        orderBy: [desc(songVersion.createdAt), desc(songVersion.id)],
        limit: 1,
        with: { songImport: true, submission: true },
      },
      currentIllustration: true,
    },
  });
  const catalog = rows.map(({ version, ...row }) => ({ ...row, currentVersion: row.currentVersion ?? version[0] ?? null }));
  const visible = includeDeleted ? catalog : catalog.filter((row) => row.currentVersion);
  const live = visible.filter((row) => !row.deleted && row.currentVersion);
  const [choices, editedImportVersionIds] = await Promise.all([
    publishedVersionIds(db, live.map((row) => row.id)),
    importVersionIdsWithSheetChanges(db, live.flatMap((row) => row.currentVersion ?? [])),
  ]);
  return visible.map((row) => ({ ...transformSongToApi(row, editedImportVersionIds, updatedSince), publishedVersionIds: choices.get(row.id) ?? [] }));
}

/**
 * Base ids of every locally deleted song. Used to drop matching results from
 * external search so an admin's deletion isn't trivially undone by re-importing.
 */
export const getDeletedSongIds = async (
  db: AppDatabase,
): Promise<Set<string>> => {
  const rows = await db
    .select({ id: song.id })
    .from(song)
    .where(eq(song.deleted, true));
  return new Set(rows.map((r) => r.id));
};

export const retrieveSingleSong = async (
  db: AppDatabase,
  songId: string,
  versionId?: string,
): Promise<SongDataApi | null> => {
  const songRaw = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      currentVersion: {
        with: { songImport: true, submission: true },
      },
      currentIllustration: true,
    },
  });

  if (!songRaw || songRaw.deleted) return null;

  let customMeta: Pick<SongDataApi, "versionAuthor"> =
    {};
  if (!songRaw.currentVersion || (versionId && songRaw.currentVersion.id !== versionId)) {
    // Capture the canonical current version before swapping in the requested one.
    const canonical = songRaw.currentVersion;
    const specificVersion = await db.query.songVersion.findFirst({
      where: and(
        versionId ? eq(songVersion.id, versionId) : and(eq(songVersion.status, "published"), isNull(songVersion.mergedIntoVersionId)),
        eq(songVersion.songId, songId),
      ),
      orderBy: [desc(songVersion.createdAt), desc(songVersion.id)],
      with: { songImport: true, user: true, submission: true },
    });
    if (!specificVersion || specificVersion.status === "deleted") return null;

    const { user: author, ...version } = specificVersion;
    songRaw.currentVersion = version;
    customMeta = customMetaOf(canonical, { ...version, user: author });
  }

  if (!songRaw.currentVersion) return null;
  const result = transformSongToApi(songRaw, await importVersionIdsWithSheetChanges(db, [songRaw.currentVersion]));
  if (songRaw.currentVersion.parentId) {
    const source = await db.query.songVersion.findFirst({ where: and(eq(songVersion.id, songRaw.currentVersion.parentId), eq(songVersion.songId, songId)), columns: { importId: true } });
    result.versionParentIsImported = !!source?.importId;
  }
  result.versionNumber = (await versionNumbers(db, [songId])).get(result.versionId ?? "");
  result.publishedVersionIds = (await publishedVersionIds(db, [songId])).get(songId) ?? [];
  Object.assign(result, customMeta);
  return result;
};

/** Load only the sheets a songbook cannot get from the official catalog. */
export async function getPinnedAlternatives(db: AppDatabase, ownerId: string) {
  const pins = db.select({ id: userFavoriteSongs.pinnedVersionId })
    .from(userFavoriteSongs)
    .innerJoin(song, eq(song.id, userFavoriteSongs.songId))
    .where(and(
      eq(userFavoriteSongs.userId, ownerId),
      eq(song.deleted, false),
      or(isNull(song.currentVersionId), ne(userFavoriteSongs.pinnedVersionId, song.currentVersionId)),
    ));

  const versions = await db.query.songVersion.findMany({
    where: and(inArray(songVersion.id, pins), ne(songVersion.status, "deleted")),
    with: {
      songImport: true,
      submission: true,
      user: { columns: { id: true, name: true, nickname: true } },
      song: { with: {
        currentIllustration: true,
        version: {
          columns: { id: true, status: true, mergedIntoVersionId: true },
          orderBy: [asc(songVersion.createdAt), asc(songVersion.id)],
        },
      } },
    },
  });

  const editedImportVersionIds = await importVersionIdsWithSheetChanges(db, versions);
  const sheets = new Map<string, SongDataApi>();
  for (const { song: parent, ...version } of versions) {
    if (parent.deleted || parent.currentVersionId === version.id) continue;
    sheets.set(version.id, {
      ...transformSongToApi({ ...parent, currentVersion: version }, editedImportVersionIds),
      ...customMetaOf(null, version),
      versionNumber: parent.version.findIndex(v => v.id === version.id) + 1,
      publishedVersionIds: parent.version
        .filter(v => v.status === "published" && !v.mergedIntoVersionId)
        .map(v => v.id),
    });
  }
  return sheets;
}

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
      currentVersion: { with: { songImport: true, submission: true } },
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
      currentVersion: { with: { songImport: true, submission: true } },
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
        nickname: row.userNickname,
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
): Promise<SongVersionDB[]> => {
  const versions = await db.query.songVersion.findMany({
    where: eq(songVersion.userId, userId),
    orderBy: [desc(songVersion.createdAt)],
    with: { submission: true, song: { columns: { currentVersionId: true } }, songImport: { columns: { sourceId: true } } },
  });
  const [numbers, editedImportVersionIds] = await Promise.all([
    versionNumbers(db, [...new Set(versions.map(v => v.songId))]),
    importVersionIdsWithSheetChanges(db, versions),
  ]);
  return versions.map(({ song, songImport, submission, ...version }) => ({ ...withSubmission(version, submission), versionNumber: numbers.get(version.id), importSourceId: editedImportVersionIds.has(version.id) ? null : songImport?.sourceId ?? null, isOfficial: song.currentVersionId === version.id }));
};

// --- Mutations ---
export const createSong = async (
  db: AppDatabase,
  submission: EditorSubmitSchema,
  userId: string,
  importId?: string,
) => {
  const now = new Date();
  const songId = songBaseId(submission.title, submission.artist);

  const existingSong = await getSongBase(db, songId).catch(() => null);

  if (!existingSong) {
    await db.insert(song).values({
      id: songId,
      createdAt: now,
      updatedAt: now,
      currentVersionId: null,
    });
  }

  const newVersion = await createSongVersion(
    db,
    submission,
    songId,
    userId,
    importId,
  );
  const newSong = await getSongBase(db, songId);

  return { newSong, newVersion };
};

export { saveSongVersion as createSongVersion } from "./song-versions/writes";

export const songImportId = (
  sourceId: SongImportDB["sourceId"],
  title: string,
  artist: string,
) => `${sourceId}/${songBaseId(title, artist)}_${Date.now()}`;

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

export const getSongVersions = async (db: AppDatabase, songId: string) => {
  const songVersions = await db
    .select()
    .from(songVersion)
    .where(eq(songVersion.id, songId));
  return songVersions;
};
