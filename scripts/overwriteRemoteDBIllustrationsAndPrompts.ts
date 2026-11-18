import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { song, songIllustration, illustrationPrompt } from "../src/lib/db/schema/song.schema";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import type { AppDatabase } from "../src/worker/api/utils";
import { eq, isNotNull } from "drizzle-orm";

const DB_NAME = "zpevnik";

// Helper to run wrangler d1 execute commands
export function runWranglerSQL(sql: string, local: boolean = false): unknown {
  try {
    const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
    const result = execFileSync(process.execPath, [wrangler, "d1", "execute", DB_NAME, local ? "--local" : "--remote", "--command", sql, "--json"], { encoding: "utf8" });
    const response = JSON.parse(result) as { success?: boolean }[];
    if (response.some((entry) => entry.success === false)) throw new Error("D1 rejected the statement");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Wrangler error: ${message}`);
    console.error(`SQL was: ${sql}`);
    throw err;
  }
}

// Helper to escape strings for SQL
export function escapeSql(str: string | null): string {
  return str === null ? 'NULL' : "'" + str.replaceAll("'", "''") + "'";
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");

    await helper.useLocalD1(async (localDb) => {
      const db = localDb as unknown as AppDatabase;
      console.log("📋 Step 1: Clearing current_illustration_id references in remote DB...");
      runWranglerSQL("UPDATE song SET current_illustration_id = NULL WHERE current_illustration_id IS NOT NULL");
      
      console.log("🗑️  Step 2: Deleting all illustrations and prompts from remote DB...");
      runWranglerSQL("DELETE FROM song_illustration");
      runWranglerSQL("DELETE FROM illustration_prompt");
      
      console.log("📤 Step 3: Copying local prompts to remote DB...");
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
        const insertSQL = `INSERT INTO song_illustration (id, song_id, prompt_id, image_model, image_url, thumbnail_url, created_at, updated_at, deleted) VALUES (${escapeSql(illustration.id)}, ${escapeSql(illustration.songId)}, ${escapeSql(illustration.promptId)}, ${escapeSql(illustration.imageModel)}, ${escapeSql(illustration.imageURL)}, ${escapeSql(illustration.thumbnailURL)}, ${illustration.createdAt.getTime() / 1000}, ${illustration.updatedAt.getTime() / 1000}, 0)`;
        console.log(`  🖼️  Inserting illustration ${illustration.id}`);
        runWranglerSQL(insertSQL);
      }
      
      console.log("🔗 Step 4: Setting current_illustration_id in remote DB...");
      const localSongs = await db
        .select()
        .from(song)
        .where(isNotNull(song.currentIllustrationId));
      
      for (const localSong of localSongs) {
        const updateSQL = `UPDATE song SET current_illustration_id = ${escapeSql(localSong.currentIllustrationId)} WHERE id = ${escapeSql(localSong.id)}`;
        console.log(`  🔗 Updating song ${localSong.id} -> illustration ${localSong.currentIllustrationId}`);
        runWranglerSQL(updateSQL);
      }
      
      console.log("✅ Sync complete!");
    });
  } catch (err) {
    console.error("Failed to execute sync:", err);
    process.exit(1);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) void main();