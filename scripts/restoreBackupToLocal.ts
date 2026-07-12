/**
 * Restores the newest production DB backup (the JSON that scripts/sync.ts
 * uploads to R2 nightly) into the LOCAL dev D1 database. Full-fidelity copy of
 * prod data (users, favorites, songs, illustrations...) minus sessions;
 * replaces the old copyRemoteDB.sh flow. Also bumps the local KV
 * songDB-version so clients don't get stuck on a stale incremental sync.
 *
 * Prod data can contain dangling foreign keys (e.g. sync sessions pointing at
 * hard-deleted versions); those rows are dropped or their nullable pointers
 * nulled, with a warning, instead of failing the restore.
 *
 * Usage: pnpm db:restore:local [--live]
 *   default: restores the newest nightly R2 backup (up to ~24h stale)
 *   --live:  snapshots the prod D1 database directly (current data; needs
 *            CF_DATABASE_ID + CF_API_TOKEN in .dev.vars)
 * Needs R2 credentials in .dev.vars (CF_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) and an existing local DB
 * (pnpm db:migrate:local).
 */
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { execSync } from "node:child_process";
import { eq, getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../src/lib/db/schema";
import type { AppDatabase } from "../src/worker/api/utils";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";

type DBBackup = {
  metadata: { createdAt: string; tables: string[] };
  tables: Record<string, Record<string, unknown>[]>;
};

// Insert order respects foreign keys (parents first). The only cycle left is
// the self-referential songVersion.parentId, broken by inserting versions with
// parentId nulled and patching it afterwards.
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
] as const;

type TableName = (typeof INSERT_ORDER)[number];

// Ephemeral state that may appear in (older) backups but is not worth
// restoring into a dev DB.
const IGNORED_TABLES = new Set(["syncSession"]);

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

const TABLES: Record<TableName, SQLiteTable> = {
  user: schema.user,
  account: schema.account,
  verification: schema.verification,
  songImport: schema.songImport,
  song: schema.song,
  songVersion: schema.songVersion,
  illustrationPrompt: schema.illustrationPrompt,
  songIllustration: schema.songIllustration,
  userFavoriteSongs: schema.userFavoriteSongs,
};

// Foreign keys to validate before inserting: prod data is not guaranteed to be
// consistent. A dangling required ref drops the row; a nullable one is nulled.
const FK_SPECS: Partial<
  Record<TableName, { column: string; ref: TableName; required: boolean }[]>
> = {
  account: [{ column: "userId", ref: "user", required: true }],
  songImport: [{ column: "userId", ref: "user", required: true }],
  songVersion: [
    { column: "songId", ref: "song", required: true },
    { column: "userId", ref: "user", required: true },
    { column: "approvedBy", ref: "user", required: false },
    { column: "importId", ref: "songImport", required: false },
  ],
  illustrationPrompt: [{ column: "songId", ref: "song", required: true }],
  songIllustration: [
    { column: "songId", ref: "song", required: true },
    { column: "promptId", ref: "illustrationPrompt", required: true },
  ],
  userFavoriteSongs: [
    { column: "userId", ref: "user", required: true },
    { column: "songId", ref: "song", required: true },
    { column: "pinnedVersionId", ref: "songVersion", required: false },
  ],
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

/** Reads all tables straight from the prod D1 database (current data). */
async function fetchLiveSnapshot(): Promise<{ key: string; backup: DBBackup }> {
  const { db: remoteDb } = await import("./shared/remote-db");
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const tableName of INSERT_ORDER) {
    tables[tableName] = (await remoteDb
      .select()
      .from(TABLES[tableName])) as Record<string, unknown>[];
  }
  return {
    key: "live prod D1 snapshot",
    backup: {
      metadata: { createdAt: new Date().toISOString(), tables: [...INSERT_ORDER] },
      tables,
    },
  };
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

/**
 * Inserts rows in batches; on a batch failure retries row-by-row so a single
 * bad row is reported and skipped instead of failing the whole table.
 */
async function insertRows<T extends SQLiteTable>(
  db: AppDatabase,
  table: T,
  tableName: string,
  rows: Record<string, unknown>[],
  insertedIds: Set<unknown>,
): Promise<{ inserted: number; failed: number }> {
  const columnCount = Object.keys(getTableColumns(table)).length;
  // Stay well under SQLite's bound-parameter limit.
  const batchSize = Math.max(1, Math.floor(90 / columnCount));
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    try {
      await db.insert(table).values(batch as T["$inferInsert"][]);
      inserted += batch.length;
      for (const row of batch) insertedIds.add(row.id);
    } catch {
      for (const row of batch) {
        try {
          await db.insert(table).values([row] as T["$inferInsert"][]);
          inserted++;
          insertedIds.add(row.id);
        } catch (error) {
          failed++;
          console.warn(
            `  ⚠️ ${tableName}: skipping row ${JSON.stringify(row.id)} — ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    }
  }
  return { inserted, failed };
}

async function restore(db: AppDatabase, backup: DBBackup) {
  const known = new Set<string>(INSERT_ORDER);
  const skipped = Object.keys(backup.tables).filter(
    (t) => !known.has(t) && !IGNORED_TABLES.has(t),
  );
  if (skipped.length > 0) {
    console.warn(
      `⚠️ Backup contains tables unknown to this script (skipping): ${skipped.join(", ")}`,
    );
  }

  console.log("Clearing local tables...");
  for (const table of DELETE_ORDER) {
    await db.delete(table);
  }

  // IDs actually inserted per table, used to validate later tables' FKs.
  const insertedIds: Record<TableName, Set<unknown>> = {
    user: new Set(),
    account: new Set(),
    verification: new Set(),
    songImport: new Set(),
    song: new Set(),
    songVersion: new Set(),
    illustrationPrompt: new Set(),
    songIllustration: new Set(),
    userFavoriteSongs: new Set(),
  };

  // songVersion.parentId is self-referential, so a row can point at a version
  // that appears later in the backup — defer it.
  const versionParents: { id: string; parentId: unknown }[] = [];

  // Backups made before the current-state derivation stored the current
  // version/illustration as pointer columns on song rows (dropped by
  // reviveRow, which only keeps known columns). Detect that legacy format and
  // translate the pointers into songVersion.status / songIllustration.isCurrent.
  const legacyCurrentVersionOf = new Map<unknown, unknown>(); // songId -> versionId
  const legacyCurrentIllustrationIds = new Set<unknown>();
  let isLegacyPointerBackup = false;

  for (const tableName of INSERT_ORDER) {
    const rawRows = backup.tables[tableName] ?? [];
    if (rawRows.length === 0) {
      console.log(`- ${tableName}: empty, skipping`);
      continue;
    }

    const table = TABLES[tableName];
    let rows = rawRows.map((raw) => reviveRow(table, raw));

    if (tableName === "song") {
      for (const raw of rawRows) {
        if ("currentVersionId" in raw || "currentIllustrationId" in raw) {
          isLegacyPointerBackup = true;
          if (raw.currentVersionId)
            legacyCurrentVersionOf.set(raw.id, raw.currentVersionId);
          if (raw.currentIllustrationId)
            legacyCurrentIllustrationIds.add(raw.currentIllustrationId);
        }
      }
      if (isLegacyPointerBackup) {
        console.log(
          "  (legacy backup with current-pointer columns — translating to statuses/flags)",
        );
      }
    }

    if (tableName === "songVersion") {
      for (const row of rows) {
        if (row.parentId) {
          versionParents.push({ id: row.id as string, parentId: row.parentId });
        }
      }
      rows = rows.map((row) => ({ ...row, parentId: null }));

      // Legacy translate: the pointer target is THE published version; any
      // other published row would violate the one-published-per-song index.
      if (isLegacyPointerBackup) {
        rows = rows.map((row) => {
          const isPointerTarget =
            legacyCurrentVersionOf.get(row.songId) === row.id;
          if (isPointerTarget && row.status !== "published")
            return { ...row, status: "published" };
          if (!isPointerTarget && row.status === "published")
            return { ...row, status: "archived" };
          return row;
        });
      }
    }

    if (tableName === "songIllustration" && isLegacyPointerBackup) {
      rows = rows.map((row) => ({
        ...row,
        isCurrent: legacyCurrentIllustrationIds.has(row.id),
      }));
    }

    // Drop rows with dangling required refs, null out dangling nullable ones.
    const specs = FK_SPECS[tableName];
    if (specs) {
      rows = rows.filter((row) => {
        for (const spec of specs) {
          const value = row[spec.column];
          if (value == null || insertedIds[spec.ref].has(value)) continue;
          if (spec.required) {
            console.warn(
              `  ⚠️ ${tableName}: dropping row ${JSON.stringify(row.id)} — ` +
                `${spec.column}=${value} missing in ${spec.ref}`,
            );
            return false;
          }
          console.warn(
            `  ⚠️ ${tableName}: nulling ${spec.column}=${value} on row ` +
              `${JSON.stringify(row.id)} — target missing in ${spec.ref}`,
          );
          row[spec.column] = null;
        }
        return true;
      });
    }

    const { inserted, failed } = await insertRows(
      db,
      table,
      tableName,
      rows,
      insertedIds[tableName],
    );
    console.log(
      `- ${tableName}: inserted ${inserted} rows` +
        (failed > 0 ? ` (${failed} skipped, see warnings)` : ""),
    );
  }

  console.log(
    `Patching parent pointers on ${versionParents.length} song versions...`,
  );
  for (const pointer of versionParents) {
    if (!insertedIds.songVersion.has(pointer.parentId)) continue;
    await db
      .update(schema.songVersion)
      .set({ parentId: pointer.parentId as string })
      .where(eq(schema.songVersion.id, pointer.id));
  }
}

/**
 * Bumps the local KV songDB-version so clients see the restored data on next
 * load. Rows keep their original prod updatedAt timestamps, so without this
 * every client's cached lastUpdate cursor is newer than anything in the
 * restore and the app's incremental sync (src/worker/api/songDB.ts) returns
 * an empty diff — the UI silently keeps showing pre-restore data forever.
 */
function bumpLocalSongDBVersion() {
  const newVersion = Date.now().toString();
  execSync(`wrangler kv key put songDB-version ${newVersion} --binding KV --local`, {
    stdio: "inherit",
  });
}

async function main() {
  const live = process.argv.includes("--live");
  const { key, backup } = live
    ? await fetchLiveSnapshot()
    : await fetchLatestBackup();
  console.log(
    `Backup ${key} created at ${backup.metadata.createdAt}, tables: ${backup.metadata.tables.join(", ")}`,
  );
  console.log("⚠️ This REPLACES all data in your local dev D1 database.");

  await D1Helper.get("DB").useLocalD1(async (db) => {
    await restore(db as unknown as AppDatabase, backup);
  });

  console.log("Bumping local songDB-version so clients skip stale incremental sync...");
  bumpLocalSongDBVersion();

  console.log("✅ Local DB restored from production backup.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
