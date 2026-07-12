import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
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
  UserDB,
  userFavoriteSongs,
} from "src/lib/db/schema";
import { songBaseId } from "src/lib/song-ids";
import type { EditorSubmitSchema } from "src/lib/contracts/editor-schema";
import { AppDatabase } from "../api/utils";
import { SongbookDataApi, SongDataApi } from "../api/api-types";

// A song row with its DERIVED current state attached: the current version is
// the single published one, the current illustration the single flagged one
// (both enforced by partial unique indexes; nothing is stored on `song`).
export type PopulatedSongDB = SongDataDB & {
  currentVersion:
    | (SongVersionDB & {
        songImport: SongImportDB | null;
        user?: UserDB | null;
      })
    | null;
  currentIllustration: SongIllustrationDB | null;
};

// Shared nested-`with` fragments that fetch the derived current state along
// with a song row. The partial unique indexes guarantee at most one row each.
const currentVersionWith = {
  where: eq(songVersion.status, "published"),
  limit: 1,
  with: { songImport: true },
} as const;

const currentIllustrationWith = {
  where: eq(songIllustration.isCurrent, true),
  limit: 1,
} as const;

// Collapses the filtered version/illustration arrays (0 or 1 rows each) of a
// relational query result into `currentVersion`/`currentIllustration`.
const toPopulatedSong = <V extends SongVersionDB, I extends SongIllustrationDB>(
  row: SongDataDB & { version: V[]; illustration: I[] },
) => {
  const { version, illustration, ...songRow } = row;
  return {
    ...songRow,
    currentVersion: version[0] ?? null,
    currentIllustration: illustration[0] ?? null,
  };
};
// Custom-payload metadata, derived purely from how the shown version relates to
// the song's canonical (published current) one — the single definition of
// "custom". When the shown version differs from canonical (or there is no
// canonical yet), it's a draft: attribute it to its author, and flag whether the
// published version has since moved past it so the UI can offer "switch to
// official". A canonical version shown as-is yields no custom metadata.
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
): Pick<SongDataApi, "customVersionAuthor" | "canonicalIsNewer"> => {
  if (!shown || (canonical && shown.id === canonical.id)) return {};
  return {
    customVersionAuthor: shown.user
      ? { id: shown.user.id, name: shown.user.nickname ?? shown.user.name }
      : undefined,
    canonicalIsNewer: canonical
      ? new Date(canonical.createdAt) > new Date(shown.createdAt)
      : false,
  };
};

// --- DTO Mapper ---
const transformSongToApi = (
  songItem: PopulatedSongDB & { favorites?: { userId: string }[] },
  updatedSince?: Date,
): SongDataApi => {
  const version = songItem.currentVersion;

  return {
    id: songItem.id,
    versionId: version?.id,
    hidden: songItem.hidden,
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

    // Only true deletions are removal signals. Hidden songs stay in the client
    // cache (with `hidden: true`) so they remain reachable via search; the browse
    // list filters them out client-side.
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
  updatedSince?: Date,
  includeHidden = false,
  includeDeleted = false,
) {
  const conditions = [];

  if (!includeHidden) {
    if (includeDeleted)
      conditions.push(or(eq(song.hidden, false), eq(song.deleted, true))!);
    else conditions.push(eq(song.hidden, false));
  }
  if (!includeDeleted) conditions.push(eq(song.deleted, false));

  if (updatedSince) {
    conditions.push(
      or(
        gte(song.updatedAt, updatedSince),
        // ...or the song's current illustration changed since (e.g. its image
        // was regenerated in place without touching the song row).
        inArray(
          song.id,
          db
            .select({ id: songIllustration.songId })
            .from(songIllustration)
            .where(
              and(
                eq(songIllustration.isCurrent, true),
                gte(songIllustration.updatedAt, updatedSince),
              ),
            ),
        ),
      )!,
    );
  }

  const songsRaw = await db.query.song.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: {
      version: currentVersionWith,
      illustration: currentIllustrationWith,
    },
  });
  // Only songs with a published version are listable — a freshly submitted
  // pending song has none yet (previously guaranteed by the pointer being set).
  return songsRaw
    .map(toPopulatedSong)
    .filter((s) => s.currentVersion !== null)
    .map((s) => transformSongToApi(s, updatedSince));
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
      version: currentVersionWith,
      illustration: currentIllustrationWith,
    },
  });

  if (!songRaw) return null;
  const populated: PopulatedSongDB = toPopulatedSong(songRaw);

  let customMeta: Pick<SongDataApi, "customVersionAuthor" | "canonicalIsNewer"> =
    {};
  if (versionId && populated.currentVersion?.id !== versionId) {
    // Capture the canonical current version before swapping in the requested one.
    const canonical = populated.currentVersion;
    const specificVersion = await db.query.songVersion.findFirst({
      where: eq(songVersion.id, versionId),
      with: { songImport: true, user: true },
    });
    if (specificVersion) {
      const { user: author, ...version } = specificVersion;
      populated.currentVersion = version;
      customMeta = customMetaOf(canonical, { ...version, user: author });
    }
  }

  const result = transformSongToApi(populated);
  Object.assign(result, customMeta);
  return result;
};

/**
 * Bulk-resolves a set of songbook entries to displayable songs: each entry shows
 * its pinned version when set (incl. pending songs that have no published
 * `currentVersion` yet), otherwise the song's current version. Done in a couple
 * of batched queries (not one `retrieveSingleSong` per entry) so a large
 * songbook stays within the Worker's subrequest budget. Returns a map keyed by
 * songId; songs that can't be shown (deleted, or no version at all) are omitted.
 */
export const resolveSongbookSongs = async (
  db: AppDatabase,
  entries: { songId: string; pinnedVersionId: string | null }[],
  // When set, skip entries whose pinned version is just the song's current one —
  // the viewer already has those from the global list, so don't ship them again.
  opts: { onlyNonCanonical?: boolean } = {},
): Promise<Map<string, SongDataApi>> => {
  const result = new Map<string, SongDataApi>();
  const songIds = [...new Set(entries.map((e) => e.songId))];
  if (songIds.length === 0) return result;

  const songs = await db.query.song.findMany({
    where: and(inArray(song.id, songIds), eq(song.deleted, false)),
    with: {
      version: { ...currentVersionWith, with: { songImport: true, user: true } },
      illustration: currentIllustrationWith,
    },
  });
  const songById = new Map<string, PopulatedSongDB>(
    songs.map((s) => [s.id, toPopulatedSong(s)]),
  );

  // Pinned versions that differ from (or stand in for a missing) current version.
  const pinnedIds = [
    ...new Set(
      entries
        .filter((e) => e.pinnedVersionId)
        .map((e) => e.pinnedVersionId as string),
    ),
  ];
  const versions = pinnedIds.length
    ? await db.query.songVersion.findMany({
        where: inArray(songVersion.id, pinnedIds),
        with: { songImport: true, user: true },
      })
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  for (const entry of entries) {
    const songRaw = songById.get(entry.songId);
    if (!songRaw) continue; // deleted / missing
    const canonical = songRaw.currentVersion;
    const pinned =
      entry.pinnedVersionId && entry.pinnedVersionId !== canonical?.id
        ? versionById.get(entry.pinnedVersionId)
        : undefined;
    if (opts.onlyNonCanonical && !pinned) continue; // canonical → already in list
    if (pinned) songRaw.currentVersion = pinned;
    const shown = songRaw.currentVersion;
    if (!shown) continue; // nothing publishable to show
    const api = transformSongToApi(songRaw);
    Object.assign(api, customMetaOf(canonical, shown));
    result.set(entry.songId, api);
  }
  return result;
};

export const getSongBase = async (
  db: AppDatabase,
  songId: string,
): Promise<SongDataDB> => {
  const result = await db.query.song.findFirst({ where: eq(song.id, songId) });
  if (!result) throw new Error("Song not found");
  return result;
};

export const getSongPopulated = async (
  db: AppDatabase,
  songId: string,
): Promise<PopulatedSongDB> => {
  const result = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      version: currentVersionWith,
      illustration: currentIllustrationWith,
    },
  });
  if (!result) throw new Error("Song not found");
  return toPopulatedSong(result);
};

export const findSongWithAllData = async (db: AppDatabase, songId: string) => {
  const completeSong = await db.query.song.findFirst({
    where: eq(song.id, songId),
    with: {
      version: {
        orderBy: [desc(songVersion.createdAt)],
        with: { songImport: true },
      },
      illustration: { orderBy: [desc(songIllustration.createdAt)] },
    },
  });

  if (!completeSong) throw new Error("Referenced song not found!");
  // The current version/illustration are derived from the full lists instead
  // of being fetched separately.
  return {
    ...completeSong,
    currentVersion:
      completeSong.version.find((v) => v.status === "published") ?? null,
    currentIllustration:
      completeSong.illustration.find((i) => i.isCurrent) ?? null,
  };
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
  const songId = songBaseId(submission.title, submission.artist);

  const existingSong = await getSongBase(db, songId).catch(() => null);

  if (!existingSong) {
    // Newly added songs by untrusted users don't have to be hidden explicitly -
    // they have no published version yet and thus won't be shown automatically.
    await db.insert(song).values({
      id: songId,
      createdAt: now,
      updatedAt: now,
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
  // Admin approval-from-editor controls. `isAdmin` lets the acting user approve
  // someone else's pending submission in place; `editAsSubmitter` keeps the
  // original submitter as the version's author (the admin stays the approver).
  options?: { isAdmin?: boolean; editAsSubmitter?: boolean },
) => {
  const existingSong = await getSongBase(db, songId);
  if (existingSong.deleted) {
    // A previously-deleted song is revived as if brand new: drop the `deleted`
    // flag and archive any published version so this submission re-enters the
    // normal trust flow (untrusted manual -> pending & not shown until
    // approved; trusted/import -> published).
    // NOTE: `hidden` is intentionally NOT reset here — hiding is sticky and must
    // survive re-imports/edits; only an admin un-hides via the dashboard.
    await db
      .update(songVersion)
      .set({ status: "archived" })
      .where(
        and(eq(songVersion.songId, songId), eq(songVersion.status, "published")),
      );
    await db
      .update(song)
      .set({ deleted: false })
      .where(eq(song.id, songId));
  }
  const now = new Date();
  // Resolve the edited-from version for lineage. The client sends a real version
  // id (the current version's id when editing the canonical song). A parentId
  // that doesn't resolve to a version of this song — e.g. a stale client value —
  // is ignored so the edit forks fresh rather than failing the whole submission.
  let parentVersion: SongVersionDB | undefined = undefined;
  if (submission.parentId) {
    parentVersion = await db.query.songVersion.findFirst({
      where: eq(songVersion.id, submission.parentId),
    });
    if (parentVersion && parentVersion.songId !== songId) {
      parentVersion = undefined;
    }
  }

  const shouldPublish = isTrusted;

  // LOGIC BRANCH A: Approve/update a pending version in place (no fork).
  // This covers two cases:
  //  - The author editing their own pending draft (updates rather than spawning
  //    a duplicate).
  //  - An admin approving someone else's pending submission straight from the
  //    editor — the submission is consumed in place instead of left dangling.
  // The admin is always recorded as the approver; `editAsSubmitter` decides
  // whether the version keeps its original author or is re-attributed to the
  // admin.
  const isOwnPending =
    parentVersion?.status === "pending" && parentVersion.userId === userId;
  const isAdminApprovingPending =
    parentVersion?.status === "pending" &&
    parentVersion.userId !== userId &&
    !!options?.isAdmin;

  if (parentVersion && (isOwnPending || isAdminApprovingPending)) {
    // The version keeps its original author (the submitter for an admin approval,
    // or themselves for an own-draft) unless an admin explicitly opts to claim
    // authorship of the edit (`editAsSubmitter === false`).
    const authorId =
      isAdminApprovingPending && options?.editAsSubmitter === false
        ? userId
        : parentVersion.userId;
    // An admin approving always publishes; a self-edit publishes only if trusted.
    const publish = shouldPublish || isAdminApprovingPending;

    const updatedVersion = await db
      .update(songVersion)
      .set({
        ...submission,
        userId: authorId,
        updatedAt: now,
        approvedBy: publish ? userId : null,
        approvedAt: publish ? now : null,
        importId: importId ?? null,
      })
      .where(eq(songVersion.id, parentVersion.id))
      .returning();

    if (publish)
      await promoteVersionToCurrent(db, songId, parentVersion.id, userId);
    return updatedVersion[0];
  }

  // LOGIC BRANCH B: Fork a new version.
  // Any other unapproved parent (someone else's pending draft, or a
  // draft/rejected version) is not part of the song's accessible lineage yet, so
  // it is ignored and the edit forks a fresh version with no parent.
  const parentIsApproved =
    parentVersion?.status === "published" ||
    parentVersion?.status === "archived";
  const parentId = parentIsApproved ? parentVersion!.id : undefined;

  const versionId = songId + "_" + now.getTime();

  const newVersion = await db
    .insert(songVersion)
    .values({
      ...submission,
      id: versionId,
      songId: songId,
      parentId: parentId,
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
};

export const promoteVersionToCurrent = async (
  db: AppDatabase,
  songId: string,
  versionId: string,
  approverId: string,
) => {
  const now = new Date();
  // Publishing IS what makes a version current, so this only needs to keep the
  // single-published-version invariant (also enforced by a partial unique
  // index): archive every other published version, then publish the target.
  // The order matters — archiving first frees the unique slot. song.updatedAt
  // is bumped so incremental sync picks up the change. D1 has no interactive
  // transactions, so the writes run as one atomic batch.
  await db.batch([
    db
      .update(songVersion)
      .set({ status: "archived" })
      .where(
        and(
          eq(songVersion.songId, songId),
          eq(songVersion.status, "published"),
          ne(songVersion.id, versionId),
        ),
      ),
    db
      .update(songVersion)
      .set({
        status: "published",
        approvedBy: approverId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(songVersion.id, versionId)),
    db.update(song).set({ updatedAt: now }).where(eq(song.id, songId)),
  ]);
};

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
