import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { songIllustration, illustrationPrompt } from "../src/lib/db/schema/song.schema";
import { execSync } from "child_process";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

const DB_NAME = "zpevnik";

// Helper to run wrangler d1 execute commands
function runWranglerSQL(sql: string, local: boolean = false): unknown {
  try {
    // Escape the SQL for shell by replacing double quotes
    const escapedSql = sql.replace(/"/g, '\\"');
    const result = execSync(
      `wrangler d1 execute ${DB_NAME} --${
        local ? "local" : "remote"
      } --command "${escapedSql}" --json`,
      {
        encoding: "utf-8",
      }
    );
    return JSON.parse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Wrangler error: ${message}`);
    console.error(`SQL was: ${sql}`);
    return null;
  }
}

// Helper to escape strings for SQL
function escapeSql(str: string | null): string {
  if (str === null) return "NULL";
  // Replace single quotes with two single quotes for SQL
  // Also escape backslashes
  return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");

    await helper.useLocalD1(async (db: DrizzleD1Database) => {
      // The current illustration travels WITH the rows (is_current flag), so
      // there are no song pointers to clear or restore.
      console.log("🗑️  Step 1: Deleting all illustrations and prompts from remote DB...");
      runWranglerSQL("DELETE FROM song_illustration");
      runWranglerSQL("DELETE FROM illustration_prompt");
      
      console.log("📤 Step 2: Copying local prompts to remote DB...");
      const localPrompts = await db
        .select()
        .from(illustrationPrompt)
        .where(eq(illustrationPrompt.deleted, false));
      
      for (const prompt of localPrompts) {
        const insertSQL = `INSERT INTO illustration_prompt (id, song_id, prompt_version, summary_model, text, created_at, updated_at, deleted) VALUES (${escapeSql(prompt.id)}, ${escapeSql(prompt.songId)}, ${escapeSql(prompt.summaryPromptVersion)}, ${escapeSql(prompt.summaryModel)}, ${escapeSql(prompt.text)}, ${prompt.createdAt.getTime() / 1000}, ${prompt.updatedAt.getTime() / 1000}, 0)`;
        console.log(`  📝 Inserting prompt ${prompt.id}`);
        runWranglerSQL(insertSQL);
      }
      
      console.log("📤 Step 3: Copying local illustrations to remote DB...");
      const localIllustrations = await db
        .select()
        .from(songIllustration)
        .where(eq(songIllustration.deleted, false));

      for (const illustration of localIllustrations) {
        const insertSQL = `INSERT INTO song_illustration (id, song_id, prompt_id, image_model, image_url, thumbnail_url, is_current, created_at, updated_at, deleted) VALUES (${escapeSql(illustration.id)}, ${escapeSql(illustration.songId)}, ${escapeSql(illustration.promptId)}, ${escapeSql(illustration.imageModel)}, ${escapeSql(illustration.imageURL)}, ${escapeSql(illustration.thumbnailURL)}, ${illustration.isCurrent ? 1 : 0}, ${illustration.createdAt.getTime() / 1000}, ${illustration.updatedAt.getTime() / 1000}, 0)`;
        console.log(`  🖼️  Inserting illustration ${illustration.id}`);
        runWranglerSQL(insertSQL);
      }

      console.log("✅ Sync complete!");
    });
  } catch (err) {
    console.error("Failed to execute sync:", err);
    process.exit(1);
  }
}

main();