import { and, desc, eq, inArray, or } from "drizzle-orm";
import { song, songVersion } from "src/lib/db/schema";
import type { SongVersionSummaryApi } from "../api/api-types";
import type { AppDatabase } from "../api/utils";

/** Lightweight history; fetch a version's sheet only when the viewer opens it. */
export async function retrieveVersionSummaries(
  db: AppDatabase,
  songId: string,
  viewerId?: string,
): Promise<SongVersionSummaryApi[] | null> {
  const parent = await db.query.song.findFirst({
    where: and(eq(song.id, songId), eq(song.deleted, false)),
    columns: { currentVersionId: true },
  });
  if (!parent) return null;

  const approved = inArray(songVersion.status, ["published", "archived"]);
  const versions = await db.query.songVersion.findMany({
    where: and(
      eq(songVersion.songId, songId),
      viewerId
        ? or(approved, and(eq(songVersion.userId, viewerId), eq(songVersion.status, "pending")))
        : approved,
    ),
    columns: { id: true, status: true, key: true, capo: true, createdAt: true, userId: true },
    with: { user: { columns: { name: true, nickname: true } } },
    orderBy: [desc(songVersion.createdAt), desc(songVersion.id)],
  });

  return versions.map(({ user, userId, ...version }) => ({
    ...version,
    author: { id: userId, name: user.nickname ?? user.name },
    isCurrent: version.id === parent.currentVersionId,
  }));
}
