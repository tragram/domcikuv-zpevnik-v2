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
  songImport,
} from "../src/lib/db/schema/song.schema";
import { AppDatabase } from "../src/worker/api/utils";
import { syncSession, userFavoriteSongs } from "../src/lib/db/schema";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.dev.vars") });

const VERBOSE = false;
const SYSTEM_EMAIL = "domho108@gmail.com";

/**
 * Parses a chordpro file and extracts metadata and content
 */
function parseChordproFile(content: string) {
  const lines = content.split("\n");
  const metadata: Record<string, string> = {};
  let contentStartIndex = 0;

  const allowedMetadataKeys = new Set([
    "title",
    "artist",
    "key",
    "capo",
    "tempo",
    "range",
    "language",
    "startMelody",
    "createdAt",
    "updatedAt",
    "illustrationId",
    "promptId",
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^\{([^:]+):\s*(.+)\}$/);

    if (match) {
      const key = match[1].trim();

      if (allowedMetadataKeys.has(key)) {
        metadata[key] = match[2].trim();
        contentStartIndex = i + 1; // Move start index past this valid metadata
      } else {
        // We found a directive, but it's a formatting directive (like {comment: ...})
        break;
      }
    } else if (line !== "") {
      // We hit actual lyrics or chords, stop parsing metadata
      break;
    }
  }

  return {
    metadata,
    chordpro: lines.slice(contentStartIndex).join("\n").trim(),
  };
}

/**
 * Creates or gets the system user for migrations
 */
async function ensureSystemUser(db: DrizzleD1Database): Promise<string> {
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, SYSTEM_EMAIL))
    .limit(1);
  if (existingUser.length > 0) {
    await db
      .update(user)
      .set({ isTrusted: true, isAdmin: true })
      .where(eq(user.id, existingUser[0].id));
    return existingUser[0].id;
  }

  const userId = "system-migration-user";
  await db.insert(user).values({
    id: userId,
    name: "System Migration User",
    email: SYSTEM_EMAIL,
    emailVerified: true,
    isTrusted: true,
    isAdmin: true,
    lastLogin: new Date(),
  });
  return userId;
}

/**
 * Clears all data from the tables
 */
async function clearTables(db: DrizzleD1Database) {
  console.log("Clearing tables...");
  await db.run(sql`PRAGMA defer_foreign_keys = OFF`);

  const tables = [
    songIllustration,
    illustrationPrompt,
    songVersion,
    songImport, // Included safely
    userFavoriteSongs,
    syncSession,
    song,
  ];

  for (const table of tables) {
    await db.delete(table);
  }

  await db.run(sql`PRAGMA defer_foreign_keys = ON`);
}

/**
 * Uploads a single song's chordpro file and sets it as Published
 */
async function uploadSong(
  db: DrizzleD1Database,
  songId: string,
  chordproPath: string,
  systemUserId: string,
  logger: (msg: string) => void,
): Promise<string> {
  logger(`\n▶️ Starting upload for: ${songId}`);
  const { metadata, chordpro } = parseChordproFile(
    fs.readFileSync(chordproPath, "utf-8"),
  );

  logger(
    `  [DEBUG] Parsed metadata for ${songId}: ${JSON.stringify(metadata)}`,
  );

  const now = new Date();
  const createdAt = metadata.createdAt
    ? new Date(parseInt(metadata.createdAt))
    : now;

  logger(`  [DEBUG] Computed createdAt for ${songId}: ${createdAt}`);

  // 1. Create the Song Shell
  logger(`  [DEBUG] 1. Inserting into 'song' table...`);
  await db.insert(song).values({
    id: songId,
    createdAt,
    updatedAt: now,
  });

  // 2. Create the Version (Status: Published)
  const versionId = `${songId}_${createdAt.getTime()}`;
  logger(
    `  [DEBUG] 2. Inserting into 'songVersion' table with ID: ${versionId}...`,
  );
  await db.insert(songVersion).values({
    id: versionId,
    songId,
    title: metadata.title,
    artist: metadata.artist,
    key: metadata.key || null,
    language: metadata.language || "other",
    capo: parseInt(metadata.capo) || 0,
    tempo: metadata.tempo || null,
    range: metadata.range || null,
    startMelody: metadata.startMelody || null,
    chordpro,
    userId: systemUserId,
    status: "published",
    approvedBy: systemUserId,
    approvedAt: createdAt,
    createdAt: createdAt,
    updatedAt: now,
  });

  // 3. Link Song to this Version
  logger(`  [DEBUG] 3. Updating 'song' with currentVersionId...`);
  await db
    .update(song)
    .set({ currentVersionId: versionId })
    .where(eq(song.id, songId));

  // 4. add to favorites
  logger(`  [DEBUG] 4. Inserting into 'userFavoriteSongs'...`);
  await db.insert(userFavoriteSongs).values({
    userId: systemUserId,
    songId,
  });

  if (VERBOSE) logger(`  Uploaded: ${songId}`);
  return metadata.illustrationId;
}

/**
 * Uploads illustrations for a song
 */
async function uploadIllustrations(
  db: DrizzleD1Database,
  songId: string,
  illustrationsYamlPath: string,
  baseFolder: string,
  logger: (msg: string) => void,
) {
  logger(`  [DEBUG] Reading illustrations YAML for ${songId}...`);
  const data = yaml.load(
    fs.readFileSync(illustrationsYamlPath, "utf-8"),
  ) as any;

  for (const prompt of data.prompts) {
    logger(`  [DEBUG] Inserting 'illustrationPrompt' ID: ${prompt.id}`);
    await db.insert(illustrationPrompt).values({
      id: prompt.id,
      songId,
      text: prompt.text,
      summaryModel: prompt.summaryModel,
      summaryPromptVersion: prompt.summaryPromptVersion,
      createdAt: new Date(prompt.createdAt),
    });

    for (const ill of prompt.illustrations) {
      const illustrationId = `${prompt.id}_${ill.imageModel}`;
      const shortPromptId = prompt.id.replace(`${songId}_`, "");

      logger(`  [DEBUG] Inserting 'songIllustration' ID: ${illustrationId}`);
      await db.insert(songIllustration).values({
        id: illustrationId,
        songId,
        promptId: prompt.id,
        imageModel: ill.imageModel,
        imageURL: `${baseFolder}/illustrations/${songId}/${shortPromptId}/full/${ill.filename}`,
        thumbnailURL: `${baseFolder}/illustrations/${songId}/${shortPromptId}/thumbnail/${ill.filename}`,
        createdAt: new Date(ill.createdAt),
      });
    }
  }
}

/**
 * Main Migration Logic
 */
async function processAndMigrateSongs(
  db: AppDatabase,
  songsPath: string,
  clearExisting: boolean = true,
  baseFolder: string = "/songs",
) {
  const systemUserId = await ensureSystemUser(db as any);
  if (clearExisting) await clearTables(db as any);

  const chordproDir = path.join(songsPath, "chordpro");
  const illustrationsDir = path.join(songsPath, "illustrations");

  const files = fs.readdirSync(chordproDir).filter((f) => f.endsWith(".pro"));
  console.log(`Processing ${files.length} songs...`);

  for (const filename of files) {
    const songId = path.basename(filename, ".pro");
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    try {
      const illustrationId = await uploadSong(
        db as any,
        songId,
        path.join(chordproDir, filename),
        systemUserId,
        logger,
      );

      const yamlPath = path.join(
        illustrationsDir,
        songId,
        "illustrations.yaml",
      );

      if (fs.existsSync(yamlPath)) {
        await uploadIllustrations(
          db as any,
          songId,
          yamlPath,
          baseFolder,
          logger,
        );

        if (illustrationId) {
          logger(
            `  [DEBUG] 5. Updating 'song' with currentIllustrationId: ${illustrationId}...`,
          );
          await (db as any)
            .update(song)
            .set({ currentIllustrationId: illustrationId })
            .where(eq(song.id, songId));
        }
      }

      if (VERBOSE) {
        console.log(`✅ Success: ${songId}`);
      }
    } catch (error) {
      console.error(`\n❌ Failed: ${songId}`);
      logs.forEach((log) => console.error(log));
      console.error(error);
    }
  }
  console.log("✅ Migration complete!");
}

async function main() {
  const songsPath = path.resolve(__dirname, "../songs");
  try {
    /*** local ***/
    await D1Helper.get("DB").useLocalD1((db) =>
      processAndMigrateSongs(db as unknown as AppDatabase, songsPath),
    );
    /*** remote ***/
    // await D1Helper.get("DB")
    //   .withCfCredentials(
    //     process.env.CF_ACCOUNT_ID,
    //     process.env.CLOUDFLARE_D1_TOKEN,
    //   )
    //   .useProxyD1(async (db) => processAndMigrateSongs(db, songsPath));
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
