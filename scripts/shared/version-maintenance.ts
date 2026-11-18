import { getTableColumns, sql } from "drizzle-orm";
import { songContentFields, songVersion } from "../../src/lib/db/schema";
import type { AppDatabase } from "../../src/worker/api/utils";

// Only for explicit database reset/restore scripts. Runtime writes keep all
// history guards enabled. Restore the exact installed triggers even on failure.
export async function withVersionMaintenance<T>(db: AppDatabase, work: () => Promise<T>) {
  const triggers = await db.select({
    name: sql<string>`name`,
    definition: sql<string>`sql`,
  }).from(sql`sqlite_master`).where(sql`type = 'trigger' and tbl_name in ('song_version', 'song_revision')`);
  try {
    for (const trigger of triggers)
      await db.run(sql.raw(`DROP TRIGGER "${trigger.name.replaceAll('"', '""')}"`));
    return await work();
  } finally {
    for (const trigger of triggers) await db.run(sql.raw(trigger.definition));
  }
}

// Legacy backups have no snapshots. Preserve existing history when present and
// create only a missing current baseline, using its actual revision number.
export async function backfillRevisionBaselines(db: AppDatabase) {
  const columns = getTableColumns(songVersion);
  const content = sql.join(songContentFields.flatMap((field) => [sql`${field}`, sql`${columns[field]}`]), sql`, `);
  await db.run(sql`INSERT INTO song_revision
    (id, version_id, number, content, status, user_id, approved_by, created_at)
    SELECT ${songVersion.id} || ':' || ${songVersion.revision}, ${songVersion.id},
      ${songVersion.revision}, json_object(${content}), ${songVersion.status},
      coalesce(${songVersion.editedBy}, ${songVersion.userId}), ${songVersion.approvedBy}, ${songVersion.updatedAt}
    FROM ${songVersion} WHERE NOT EXISTS
      (SELECT 1 FROM song_revision WHERE version_id = ${songVersion.id} AND number = ${songVersion.revision})`);
}
