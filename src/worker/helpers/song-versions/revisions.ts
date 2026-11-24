import { and, asc, desc, eq, getTableColumns, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  song,
  songRevision,
  songVersion,
  songContentFields,
  user,
} from "src/lib/db/schema";
import type { SongVersionDB, SongRevisionContent } from "src/lib/db/schema";
import type { AppDatabase } from "../../api/utils";
import { withSubmission } from "src/lib/song-submission";

export const conflict = () =>
  new HTTPException(409, {
    message:
      "This version changed. Reload it before saving, or review the conflict in the admin dashboard.",
  });

export async function versionActor(db: AppDatabase, userId: string) {
  const actor = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!actor)
    throw new HTTPException(401, { message: "Authentication required" });
  return actor;
}

export async function loadVersion(
  db: AppDatabase,
  songId: string,
  versionId: string,
) {
  const version = await db.query.songVersion.findFirst({
    with: { submission: true },
    where: and(eq(songVersion.id, versionId), eq(songVersion.songId, songId)),
  });
  if (!version) throw new HTTPException(404, { message: "Version not found" });
  const { submission, ...row } = version;
  return withSubmission(row, submission);
}

export function contentOf(version: SongRevisionContent): SongRevisionContent {
  return Object.fromEntries(
    songContentFields.map((key) => [key, version[key]]),
  ) as SongRevisionContent;
}

export function sameContent(a: SongRevisionContent, b: SongRevisionContent) {
  return songContentFields.every((key) => a[key] === b[key]);
}

const curationFields = [
  "title", "artist", "chordpro", "key", "language", "capo", "range", "startMelody", "tempo",
] as const satisfies readonly (keyof SongRevisionContent)[];

export async function curatedImportIds(db: AppDatabase, versions: readonly Pick<SongVersionDB, "id" | "importId" | "revision">[]) {
  const ids = versions.filter((version) => version.importId && version.revision > 1).map((version) => version.id);
  const curated = new Set<string>();
  for (let i = 0; i < ids.length; i += 99) {
    const snapshots = await db.select({ versionId: songRevision.versionId, number: songRevision.number, content: songRevision.content })
      .from(songRevision)
      .innerJoin(songVersion, eq(songVersion.id, songRevision.versionId))
      .where(and(inArray(songRevision.versionId, ids.slice(i, i + 99)),
        or(eq(songRevision.number, 1), eq(songRevision.number, songVersion.revision))));
    const originals = new Map(snapshots.filter((row) => row.number === 1).map((row) => [row.versionId, row.content]));
    for (const row of snapshots) {
      const original = originals.get(row.versionId);
      if (original && curationFields.some((field) => original[field] !== row.content[field])) curated.add(row.versionId);
    }
  }
  return curated;
}

export function firstSheetChange(
  db: AppDatabase,
  versionId: string,
  baseline: SongRevisionContent,
  beforeRevision?: number,
) {
  return db.query.songRevision.findFirst({
    columns: { userId: true },
    where: and(
      eq(songRevision.versionId, versionId),
      beforeRevision === undefined ? undefined : lt(songRevision.number, beforeRevision),
      or(...curationFields.map((field) =>
        sql`json_extract(${songRevision.content}, ${`$.${field}`}) is not ${baseline[field]}`,
      )),
    ),
    orderBy: asc(songRevision.number),
  });
}

export async function isFirstImportCuration(
  db: AppDatabase,
  base: SongVersionDB,
  next: SongRevisionContent,
) {
  if (!base.importId || curationFields.every((field) => base[field] === next[field])) return false;
  // Lifecycle events and changes to version details or the video also create snapshots.
  const priorSheet = await firstSheetChange(db, base.id, base, base.revision);
  return !priorSheet;
}

export const officialCondition = (songId: string, officialId: string | null) =>
  and(
    eq(song.id, songId),
    eq(song.deleted, false),
    officialId === null
      ? isNull(song.currentVersionId)
      : eq(song.currentVersionId, officialId),
  )!;

// The revision trigger rejects stale counters rather than silently updating zero
// rows, so any following statements in an atomic batch also roll back.
type VersionChanges = Partial<Pick<SongVersionDB,
  (typeof songContentFields)[number] | "status" | "userId" | "approvedBy" | "approvedAt" | "importId" | "mergedIntoVersionId"
>>;
export function reviseVersion(
  db: AppDatabase,
  base: SongVersionDB,
  changes: VersionChanges,
  actorId: string,
  officialId?: string | null,
) {
  const songCondition = officialId === undefined
    ? and(eq(song.id, base.songId), eq(song.deleted, false))!
    : officialCondition(base.songId, officialId);
  const revision = sql<number>`case when exists (
    select 1 from ${song} where ${songCondition}
  ) then ${base.revision + 1} else 0 end`;
  return db
    .update(songVersion)
    .set({ ...changes, revision, editedBy: actorId, updatedAt: new Date() })
    .where(eq(songVersion.id, base.id));
}

export async function withVersionConflict<T>(
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    let cause: unknown = error;
    while (cause instanceof Error) {
      if (cause.message.includes("Source already imported"))
        throw new HTTPException(409, { message: "This source is already imported. Reload its existing version." });
      if (
        cause.message.includes("VERSION_CONFLICT") ||
        cause.message.includes("NOT NULL constraint failed: song_version.id")
      )
        throw conflict();
      cause = cause.cause;
    }
    throw error;
  }
}

export async function requireHistoryAccess(
  db: AppDatabase,
  songId: string,
  versionId: string,
  userId: string,
) {
  const [version, actor, parent] = await Promise.all([
    loadVersion(db, songId, versionId),
    versionActor(db, userId),
    db.query.song.findFirst({
      where: and(eq(song.id, songId), eq(song.deleted, false)),
    }),
  ]);
  if (!parent) throw new HTTPException(404, { message: "Song not found" });
  if (version.userId !== userId && !actor.isAdmin)
    throw new HTTPException(403, {
      message: "Revision history is available to the owner and admins.",
    });
  return { version, actor, parent };
}

export async function retrieveRevisions(
  db: AppDatabase,
  songId: string,
  versionId: string,
  userId: string,
  offset = 0,
) {
  await requireHistoryAccess(db, songId, versionId, userId);
  const rows = await db
    .select({
      ...getTableColumns(songRevision),
      contributorName: sql<string>`coalesce(${user.nickname}, ${user.name})`,
    })
    .from(songRevision)
    .innerJoin(user, eq(songRevision.userId, user.id))
    .where(eq(songRevision.versionId, versionId))
    .orderBy(desc(songRevision.number))
    .limit(26)
    .offset(offset);
  return {
    revisions: rows
      .slice(0, 25)
      .map((row, index) => ({
        ...row,
        previousContent: rows[index + 1]?.content ?? null,
      })),
    nextOffset: rows.length > 25 ? offset + 25 : null,
  };
}

export async function restoreRevision(
  db: AppDatabase,
  songId: string,
  versionId: string,
  number: number,
  expectedRevision: number,
  userId: string,
) {
  const { version, actor, parent } = await requireHistoryAccess(
    db,
    songId,
    versionId,
    userId,
  );
  if (version.revision !== expectedRevision) throw conflict();
  if (version.mergedIntoVersionId || version.status === "deleted")
    throw new HTTPException(400, {
      message: "Restore the version lifecycle separately first.",
    });
  if (version.status !== "pending" && !actor.isAdmin && !actor.isTrusted)
    throw new HTTPException(403, {
      message: "Published content requires admin review.",
    });
  const snapshot = await db.query.songRevision.findFirst({
    where: and(
      eq(songRevision.versionId, versionId),
      eq(songRevision.number, number),
    ),
  });
  if (!snapshot)
    throw new HTTPException(404, { message: "Revision not found" });
  if (sameContent(version, snapshot.content)) return version;
  await withVersionConflict(() =>
    db.batch([
      reviseVersion(
        db,
        version,
        snapshot.content,
        userId,
        parent.currentVersionId,
      ),
      db.update(song).set({ updatedAt: new Date() }).where(eq(song.id, songId)),
    ]),
  );
  return loadVersion(db, songId, versionId);
}
