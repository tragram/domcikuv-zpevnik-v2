import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { song } from "../src/lib/db/schema/song.schema";

import { execSync } from "child_process";
import { DrizzleD1Database } from "drizzle-orm/d1";

const DB_NAME = "zpevnik";

// Helper to run wrangler d1 execute commands
function runWranglerSQL(sql: string, local: boolean = true): any {
  try {
    const result = execSync(
      `wrangler d1 execute ${DB_NAME} --${
        local ? "local" : "remote"
      } --command "${sql}" --json`,
      {
        encoding: "utf-8",
      }
    );
    return JSON.parse(result);
  } catch (err: any) {
    console.error(`❌ Wrangler error: ${err.message}`);
    return null;
  }
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");

    await helper.useLocalD1(async (db: DrizzleD1Database) => {
      const localSongs = await db.select().from(song);
      // Sync loop
      for (const local of localSongs) {
        const updateSQL = `UPDATE song SET created_at = ${local.createdAt.getTime()/1000} WHERE id = '${local.id}'`;
        console.log(
          `🔁 Updating ${local.id}: ${local.createdAt.getTime()/1000} with ${updateSQL}`
        );
        runWranglerSQL(updateSQL,true);
      }
    });
  } catch (err) {
    console.error("Failed to execute migration:", err);
    process.exit(1);
  }
}

main();

console.log("✅ Sync complete.");
