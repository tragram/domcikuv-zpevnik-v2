/// <reference types="../../worker-configuration.d.ts" />
import { drizzle } from "drizzle-orm/d1";
import { getTableName } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../lib/db/schema";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}

interface BackupData {
  metadata: {
    version: string;
    database: string;
    createdAt: string;
    tables: string[];
  };
  tables: Record<string, any[]>;
}

/**
 * Scheduled handler for backing up D1 database to R2
 * Runs daily at 4 AM UTC
 *
 * This creates a JSON backup of all tables using Drizzle ORM queries
 */
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    c: ExecutionContext,
  ): Promise<void> {
    try {
      const db = drizzle(env.DB, { schema });

      // Create a timestamp for the backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupKey = `backups/db-backup-${timestamp}.json`;

      const songDBVersion = (await env.KV.get("songDB-version")) ?? "v0";
      // Initialize backup data structure
      const backupData: BackupData = {
        metadata: {
          version: songDBVersion,
          database: "zpevnik",
          createdAt: new Date().toISOString(),
          tables: [],
        },
        tables: {},
      };
      const tables = Object.entries(schema).filter(([key, value]) => {
        // Check for the Drizzle table symbol
        const isDrizzleTable =
          value &&
          typeof value === "object" &&
          Symbol.for("drizzle:IsDrizzleTable") in value;

        return isDrizzleTable;
      });

      console.log(`Found ${tables.length} tables`);

      // Backup each table using Drizzle
      for (const [tableName, table] of tables) {
        console.log(`Backing up table: ${tableName}`);

        try {
          // Use Drizzle's type-safe select to get all data
          const rows = await db
            .select()
            .from(table as any)
            .all();

          // Store the data
          backupData.tables[tableName] = rows;
          backupData.metadata.tables.push(tableName);

          console.log(`  ✓ Backed up ${rows.length} rows from ${tableName}`);
        } catch (error) {
          console.error(`  ✗ Failed to backup ${tableName}:`, error);
        }
      }
      // Convert to JSON
      const jsonBackup = JSON.stringify(backupData, null, 2);

      // Upload to R2
      await env.R2_BUCKET.put(backupKey, jsonBackup, {
        httpMetadata: {
          contentType: "application/json",
        },
        customMetadata: {
          backupDate: new Date().toISOString(),
          databaseName: "zpevnik",
          type: "automated-backup",
          format: "json",
          tableCount: String(backupData.metadata.tables.length),
        },
      });

      console.log(`✓ Backup completed successfully: ${backupKey}`);
      console.log(
        `  Tables backed up: ${backupData.metadata.tables.join(", ")}`,
      );

      // Optional: Clean up old backups (keep last 30 days)
      await cleanupOldBackups(env.R2_BUCKET, 30);
    } catch (error) {
      console.error("Backup failed:", error);
      throw error; // Re-throw to mark the scheduled task as failed
    }
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      await this.scheduled({} as ScheduledEvent, env, ctx);
      return new Response("Backup completed successfully", { status: 200 });
    } catch (error) {
      return new Response(`Backup failed: ${error}`, { status: 500 });
    }
  },
};

/**
 * Clean up backups older than the specified number of days
 */
async function cleanupOldBackups(
  bucket: R2Bucket,
  keepDays: number,
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);

  console.log(`Cleaning up backups older than ${keepDays} days...`);

  // List all backup files
  const list = await bucket.list({ prefix: "backups/" });

  let deletedCount = 0;
  for (const object of list.objects) {
    // Parse the timestamp from the filename
    const match = object.key.match(
      /db-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/,
    );
    if (match) {
      const backupDate = new Date(
        match[1].replace(/-/g, ":").replace("T", "T").slice(0, -3),
      );

      if (backupDate < cutoffDate) {
        await bucket.delete(object.key);
        deletedCount++;
        console.log(`  Deleted old backup: ${object.key}`);
      }
    }
  }

  if (deletedCount > 0) {
    console.log(`✓ Cleaned up ${deletedCount} old backup(s)`);
  } else {
    console.log(`✓ No old backups to clean up`);
  }
}
