import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { eq, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as fs from "fs";
import yaml from "js-yaml";
import * as path from "path";
import { user } from "../src/lib/db/schema/auth.schema";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songVersion,
} from "../src/lib/db/schema/song.schema";

import { dirname } from "path";
import { fileURLToPath } from "url";
import { syncSessionTable, userFavoriteSongs } from "../src/lib/db/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Types for YAML metadata structure
 */
interface IllustrationMetadata {
  createdAt: number;
  imageModel: string;
  filename: string;
}

interface PromptMetadata {
  promptId: string;
  songId: string;
  createdAt: number;
  summaryPromptVersion: string;
  summaryModel: string;
  text: string;
  illustrations: IllustrationMetadata[];
}

interface SongIllustrationsYAML {
  songId: string;
  prompts: PromptMetadata[];
}

/**
 * Parses a chordpro file and extracts metadata and content
 */
function parseChordproFile(content: string): {
  metadata: Record<string, string>;
  chordpro: string;
} {
  const lines = content.split("\n");
  const metadata: Record<string, string> = {};
  let contentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.endsWith("}")) {
      const match = line.match(/^\{([^:]+):\s*(.+)\}$/);
      if (match) {
        const [, key, value] = match;
        metadata[key.trim()] = value.trim();
      }
    } else if (line === "") {
      // Empty line marks end of metadata
      contentStartIndex = i + 1;
      break;
    } else {
      // Non-directive, non-empty line - metadata section is over
      contentStartIndex = i;
      break;
    }
  }

  const chordpro = lines.slice(contentStartIndex).join("\n").trim();
  return { metadata, chordpro };
}

/**
 * Creates or gets the system user for migrations
 */
async function ensureSystemUser(db: DrizzleD1Database): Promise<string> {
  // Check if system user exists
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, SYSTEM_EMAIL))
    .get();

  if (existingUser) {
    return existingUser.id;
  }

  // Create system user
  const userId = "system-migration-user";
  await db.insert(user).values({
    id: userId,
    name: "System Migration User",
    email: SYSTEM_EMAIL,
    emailVerified: true,
    isTrusted: true,
    isAdmin: true,
    isFavoritesPublic: false,
    lastLogin: new Date(),
  });

  console.log("Created system migration user");
  return userId;
}

/**
 * Clears all data from the tables
 */
async function clearTables(db: DrizzleD1Database): Promise<void> {
  console.log("Clearing existing data from tables...");

  // Disable foreign key checks temporarily
  await db.run(sql`PRAGMA defer_foreign_keys = OFF`);

  // Delete in any order now
  await db.delete(songIllustration);
  await db.delete(illustrationPrompt);
  await db.delete(songVersion);
  await db.delete(userFavoriteSongs);
  await db.delete(syncSessionTable);
  await db.delete(song);

  // Re-enable foreign key checks
  await db.run(sql`PRAGMA defer_foreign_keys = ON`);

  console.log("Tables cleared successfully");
}

/**
 * Uploads a single song's chordpro file to the database
 * returns currentIllustrationId to be entered after illustration exists
 */
async function uploadSong(
  db: DrizzleD1Database,
  songId: string,
  chordproPath: string,
  systemUserId: string
): Promise<string> {
  // Read and parse chordpro file
  const content = fs.readFileSync(chordproPath, "utf-8");
  const { metadata, chordpro } = parseChordproFile(content);

  const now = new Date();

  // Create song record
  const songId_db = songId;
  const createdAt = metadata.createdAt
    ? new Date(parseInt(metadata.createdAt))
    : now;
  await db.insert(song).values({
    id: songId_db,
    createdAt,
    updatedAt: now,
    hidden: false,
    deleted: false,
    currentVersionId: null,
    currentIllustrationId: null,
  });

  // Create song version
  const versionId = `${songId}_${createdAt.getTime()}`;
  await db.insert(songVersion).values({
    id: versionId,
    songId: songId_db,
    title: metadata.title || "",
    artist: metadata.artist || "",
    key: metadata.key || null,
    language: metadata.language || "other",
    capo: metadata.capo ? parseInt(metadata.capo) : null,
    range: metadata.range || null,
    startMelody: metadata.startMelody || null,
    tempo: metadata.tempo || null,
    userId: systemUserId,
    approved: true,
    approvedBy: systemUserId,
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
    chordpro: chordpro,
    deleted: false,
  });

  // Update song to point to current version
  await db
    .update(song)
    .set({ currentVersionId: versionId })
    .where(eq(song.id, songId_db));

  if (VERBOSE) console.log(`  Uploaded song: ${songId}`);
  return metadata.illustrationId;
}

/**
 * Uploads illustrations for a song
 */
async function uploadIllustrations(
  db: DrizzleD1Database,
  songId: string,
  illustrationsYamlPath: string,
  baseFolder: string
): Promise<void> {
  if (!fs.existsSync(illustrationsYamlPath)) {
    console.log(`  No illustrations.yaml found for song: ${songId}`);
    return;
  }

  // Read and parse YAML
  const yamlContent = fs.readFileSync(illustrationsYamlPath, "utf-8");
  const data = yaml.load(yamlContent) as SongIllustrationsYAML;

  for (const promptData of data.prompts) {
    // Insert illustration prompt
    await db.insert(illustrationPrompt).values({
      id: promptData.promptId,
      songId: songId,
      summaryPromptVersion: promptData.summaryPromptVersion,
      summaryModel: promptData.summaryModel,
      text: promptData.text,
      createdAt: new Date(promptData.createdAt),
      updatedAt: new Date(promptData.createdAt),
      deleted: false,
    });

    // Insert illustrations for this prompt
    for (const illustrationData of promptData.illustrations) {
      const illustrationId = `${promptData.promptId}_${illustrationData.imageModel}`;

      // Construct URLs
      const imageURL = `${baseFolder}/illustrations/${songId}/${promptData.promptId.replace(
        songId + "_",
        ""
      )}/full/${illustrationData.filename}`;
      const thumbnailURL = `${baseFolder}/illustrations/${songId}/${promptData.promptId.replace(
        songId + "_",
        ""
      )}/thumbnail/${illustrationData.filename}`;

      await db.insert(songIllustration).values({
        id: illustrationId,
        songId: songId,
        promptId: promptData.promptId,
        imageModel: illustrationData.imageModel,
        imageURL: imageURL,
        thumbnailURL: thumbnailURL,
        commonR2Key: null, // Not using R2 storage for local files
        createdAt: new Date(illustrationData.createdAt),
        updatedAt: new Date(illustrationData.createdAt),
        deleted: false,
      });
    }
  }

  if (
    data.prompts.filter((p) =>
      p.illustrations.some((i) => i.imageModel !== "FLUX.1-dev")
    )
  ) {
    console.log(
      `  Uploaded ${data.prompts.reduce(
        (sum, p) => sum + p.illustrations.length,
        0
      )} illustrations for song: ${songId}`
    );
  }
}

async function updateCurrentIllustration(
  db: DrizzleD1Database,
  songId: string,
  illustrationId: string
) {
  if (!illustrationId) console.warn("Song", songId, "has no illustration set!");
  await db
    .update(song)
    .set({ currentIllustrationId: illustrationId })
    .where(eq(song.id, songId));
}

/**
 * Processes all songs from the file structure
 */
async function processAndMigrateSongs(
  db: DrizzleD1Database,
  songsPath: string,
  clearExisting: boolean = true,
  baseFolder: string = "/songs"
): Promise<void> {
  console.log(`\nProcessing songs from: ${songsPath}`);

  // Ensure system user exists
  const systemUserId = await ensureSystemUser(db);

  // Clear existing data if requested
  if (clearExisting) {
    await clearTables(db);
  }

  const chordproDir = path.join(songsPath, "chordpro");
  const illustrationsDir = path.join(songsPath, "illustrations");

  if (!fs.existsSync(chordproDir)) {
    throw new Error(`Chordpro directory not found: ${chordproDir}`);
  }

  // Get all chordpro files
  const chordproFiles = fs
    .readdirSync(chordproDir)
    .filter((f) => f.endsWith(".pro"));

  console.log(`Found ${chordproFiles.length} songs to process:`);

  let successCount = 0;
  let errorCount = 0;
  for (const filename of chordproFiles) {
    const songId = path.basename(filename, ".pro");
    const chordproPath = path.join(chordproDir, filename);
    let currentIllustrationId;
    try {
      if (VERBOSE) console.log(`Processing: ${songId}`);

      // Upload song and version
      currentIllustrationId = await uploadSong(
        db,
        songId,
        chordproPath,
        systemUserId
      );

      // Upload illustrations if they exist
      const illustrationsYamlPath = path.join(
        illustrationsDir,
        songId,
        "illustrations.yaml"
      );

      if (fs.existsSync(illustrationsYamlPath)) {
        await uploadIllustrations(
          db,
          songId,
          illustrationsYamlPath,
          baseFolder
        );
      }
      await updateCurrentIllustration(db, songId, currentIllustrationId);

      successCount++;
    } catch (error) {
      console.error(`❌ Error processing song ${songId}:`, error);
      console.log(
        await db.select().from(song).where(eq(song.id, songId))
      );
      console.log(
        await db
          .select()
          .from(songIllustration)
          .where(eq(songIllustration.songId, songId))
      );
      console.log(currentIllustrationId);
      throw new Error();
      errorCount++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
}

/**
 * Main execution function
 */
async function main() {
  const songsPath = path.resolve(__dirname, "../songs");
  const clearExisting = true; // Set to false to append instead of replacing

  console.log("Starting local data upload to D1...\n");

  try {
    await D1Helper.get("DB").useLocalD1(async (db) =>
      processAndMigrateSongs(db, songsPath, clearExisting)
    );

    if (VERBOSE) console.log("\n✅ Upload completed successfully!");
  } catch (error) {
    console.error("\n❌ Upload failed:", error);
    process.exit(1);
  }
}

// warning: this script will wipe all your DB tables except users!
const VERBOSE = false;
// will be used to insert all the songs & illustrations (if a user with this email exists, they will be added under his name)
const SYSTEM_EMAIL = "system@migration.local";

main().catch(console.error);
