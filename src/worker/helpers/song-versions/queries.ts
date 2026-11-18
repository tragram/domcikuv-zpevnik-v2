import { versionNumbers } from "./numbering";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { song, songVersion } from "src/lib/db/schema";
import type { SongVersionSummaryApi } from "../../api/api-types";
import type { AppDatabase } from "../../api/utils";

/** Lightweight history; fetch a version's sheet only when the viewer opens it. */
export async function retrieveVersionSummaries(
  db: AppDatabase,
  songId: string,
  viewerId?: string,
  shownVersionId?: string,
): Promise<SongVersionSummaryApi[] | null> {
  const parent = await db.query.song.findFirst({
    where: and(eq(song.id, songId), eq(song.deleted, false)),
    columns: { currentVersionId: true },
  });
  if (!parent) return null;

  const pinned = viewerId ? await db.query.userFavoriteSongs.findFirst({
    where: (favorites, { and, eq }) => and(eq(favorites.userId, viewerId), eq(favorites.songId, songId)),
  }) : null;
  const approved = or(eq(songVersion.status, "published"), and(
    eq(songVersion.status, "archived"),
    or(eq(songVersion.id, shownVersionId ?? ""), eq(songVersion.id, pinned?.pinnedVersionId ?? "")),
  ));
  const versions = await db.query.songVersion.findMany({
    where: and(
      eq(songVersion.songId, songId),
      isNull(songVersion.mergedIntoVersionId),
      viewerId
        ? or(approved, and(eq(songVersion.userId, viewerId), eq(songVersion.status, "pending")))
        : approved,
    ),
    columns: { id: true, status: true, key: true, capo: true, createdAt: true, updatedAt: true, userId: true, label: true, description: true, revision: true },
    with: { user: { columns: { name: true, nickname: true } }, songImport: { columns: { sourceId: true } } },
    orderBy: [desc(songVersion.createdAt), desc(songVersion.id)],
  });

  const numbers = await versionNumbers(db, [songId]);
  return versions.map(({ user, userId, songImport, ...version }) => ({
    ...version,
    versionNumber: numbers.get(version.id),
    author: { id: userId, name: user.nickname ?? user.name },
    isCurrent: version.id === parent.currentVersionId,
    importSourceId: songImport?.sourceId ?? null,
  }));
}
