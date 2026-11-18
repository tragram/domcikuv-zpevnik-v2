import { inArray, asc } from "drizzle-orm";
import { songVersion } from "src/lib/db/schema";
import type { AppDatabase } from "../../api/utils";

// Display-only positions in creation order. Count labeled and official sheets
// too, so renaming a sheet or selecting official does not renumber alternatives.
export async function versionNumbers(db: AppDatabase, songIds?: string[]) {
  const result = new Map<string, number>();
  const batches: (string[] | undefined)[] = songIds === undefined ? [undefined] : [];
  const ids = [...new Set(songIds)];
  for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
  for (const batch of batches) {
    const rows = await db.select({ id: songVersion.id, songId: songVersion.songId })
      .from(songVersion)
      .where(batch ? inArray(songVersion.songId, batch) : undefined)
      .orderBy(asc(songVersion.songId), asc(songVersion.createdAt), asc(songVersion.id));
    const counts = new Map<string, number>();
    for (const row of rows) {
      const number = (counts.get(row.songId) ?? 0) + 1;
      counts.set(row.songId, number);
      result.set(row.id, number);
    }
  }
  return result;
}
