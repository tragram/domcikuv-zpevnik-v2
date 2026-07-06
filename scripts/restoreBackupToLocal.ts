/**
 * Restores the newest production DB backup (the JSON that scripts/sync.ts
 * uploads to R2 nightly) into the LOCAL dev D1 database. Full-fidelity copy of
 * prod data (users, favorites, songs, illustrations...) minus sessions, with
 * no wrangler version hacks — replaces the old copyRemoteDB.sh flow.
 *
 * Usage: pnpm db:restore:local
 * Needs R2 credentials in .dev.vars (CF_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) and an existing local DB
 * (pnpm db:migrate:local).
 */
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { eq, getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../src/lib/db/schema";
import type { AppDatabase } from "../src/worker/api/utils";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";

type DBBackup = {
  metadata: { createdAt: string; tables: string[] };
  tables: Record<string, Record<string, unknown>[]>;
};

// Insert order respects foreign keys (parents first). The song ⟷ songVersion /
// songIllustration cycle is broken by inserting song rows with the two
// "current" pointers nulled and patching them afterwards.
const INSERT_ORDER = [
  "user",
  "account",
  "verification",
  "songImport",
  "song",
  "songVersion",
  "illustrationPrompt",
  "songIllustration",
  "userFavoriteSongs",
  "syncSession",
] as const;

// Delete order: children first. Local sessions are wiped too since their
// users get replaced.
const DELETE_ORDER: SQLiteTable[] = [
  schema.syncSession,
  schema.userFavoriteSongs,
  schema.songIllustration,
  schema.illustrationPrompt,
  schema.songVersion,
  schema.song,
  schema.songImport,
  schema.session,
  schema.account,
  schema.verification,
  schema.user,
];

const TABLES: Record<(typeof INSERT_ORDER)[number], SQLiteTable> = {
  user: schema.user,
  account: schema.account,
  verification: schema.verification,
  songImport: schema.songImport,
  song: schema.song,
  songVersion: schema.songVersion,
  illustrationPrompt: schema.illustrationPrompt,
  songIllustration: schema.songIllustration,
  userFavoriteSongs: schema.userFavoriteSongs,
  syncSession: schema.syncSession,
};

/** Revives JSON values into what the drizzle column expects (Dates mainly). */
function reviveRow(table: SQLiteTable, raw: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (!(key in raw)) continue;
    const value = raw[key];
    row[key] =
      column.dataType === "date" && value != null
        ? new Date(value as string | number)
        : value;
  }
  return row;
}

async function fetchLatestBackup(): Promise<{ key: string; backup: DBBackup }> {
  const listResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "backups/db-backup-",
    }),
  );
  const files = (listResult.Contents ?? []).filter((f) => f.Key);
  if (files.length === 0) {
    throw new Error("No backups found in R2 under backups/db-backup-");
  }
  // Keys embed an ISO timestamp, so lexicographic max = newest.
  const latest = files.reduce((a, b) => (a.Key! > b.Key! ? a : b));

  console.log(`Downloading ${latest.Key}...`);
  const object = await s3.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: latest.Key! }),
  );
  const body = await object.Body!.transformToString();
  return { key: latest.Key!, backup: JSON.parse(body) as DBBackup };
}

async function insertRows<T extends SQLiteTable>(
  db: AppDatabase,
  table: T,
  rows: Record<string, unknown>[],
) {
  const columnCount = Object.keys(getTableColumns(table)).length;
  // Stay well under SQLite's bound-parameter limit.
  const batchSize = Math.max(1, Math.floor(90 / columnCount));
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(table).values(batch as T["$inferInsert"][]);
  }
}

async function restore(db: AppDatabase, backup: DBBackup) {
  const known = new Set<string>(INSERT_ORDER);
  const skipped = Object.keys(backup.tables).filter((t) => !known.has(t));
  if (skipped.length > 0) {
    console.warn(
      `⚠️ Backup contains tables unknown to this script (skipping): ${skipped.join(", ")}`,
    );
  }

  console.log("Clearing local tables...");
  for (const table of DELETE_ORDER) {
    await db.delete(table);
  }

  // song rows referencing versions/illustrations that don't exist yet — defer.
  const songPointers: {
    id: string;
    currentVersionId: unknown;
    currentIllustrationId: unknown;
  }[] = [];
  // songVersion.parentId is self-referential, so a row can point at a version
  // that appears later in the backup — defer it too.
  const versionParents: { id: string; parentId: unknown }[] = [];

  for (const tableName of INSERT_ORDER) {
    const rawRows = backup.tables[tableName] ?? [];
    if (rawRows.length === 0) {
      console.log(`- ${tableName}: empty, skipping`);
      continue;
    }

    const table = TABLES[tableName];
    let rows = rawRows.map((raw) => reviveRow(table, raw));

    if (tableName === "song") {
      for (const row of rows) {
        if (row.currentVersionId || row.currentIllustrationId) {
          songPointers.push({
            id: row.id as string,
            currentVersionId: row.currentVersionId,
            currentIllustrationId: row.currentIllustrationId,
          });
        }
      }
      rows = rows.map((row) => ({
        ...row,
        currentVersionId: null,
        currentIllustrationId: null,
      }));
    }

    if (tableName === "songVersion") {
      for (const row of rows) {
        if (row.parentId) {
          versionParents.push({ id: row.id as string, parentId: row.parentId });
        }
      }
      rows = rows.map((row) => ({ ...row, parentId: null }));
    }

    await insertRows(db, table, rows);
    console.log(`- ${tableName}: inserted ${rows.length} rows`);
  }

  console.log(`Patching current version/illustration pointers on ${songPointers.length} songs...`);
  for (const pointer of songPointers) {
    await db
      .update(schema.song)
      .set({
        currentVersionId: pointer.currentVersionId as string | null,
        currentIllustrationId: pointer.currentIllustrationId as string | null,
      })
      .where(eq(schema.song.id, pointer.id));
  }

  console.log(`Patching parent pointers on ${versionParents.length} song versions...`);
  for (const pointer of versionParents) {
    await db
      .update(schema.songVersion)
      .set({ parentId: pointer.parentId as string | null })
      .where(eq(schema.songVersion.id, pointer.id));
  }
}

async function main() {
  const { key, backup } = await fetchLatestBackup();
  console.log(
    `Backup ${key} created at ${backup.metadata.createdAt}, tables: ${backup.metadata.tables.join(", ")}`,
  );
  console.log("⚠️ This REPLACES all data in your local dev D1 database.");

  await D1Helper.get("DB").useLocalD1(async (db) => {
    await restore(db as unknown as AppDatabase, backup);
  });

  console.log("✅ Local DB restored from production backup.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
