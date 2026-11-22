import { withVersionMaintenance } from "./shared/version-maintenance";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import yaml from "js-yaml";
import * as path from "path";
import { user } from "../src/lib/db/schema/auth.schema";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songVersion,
  songRevision,
  songSubmission,
  songImport,
} from "../src/lib/db/schema/song.schema";
import type { AppDatabase } from "../src/worker/api/utils";
import { syncSession, userFavoriteSongs } from "../src/lib/db/schema";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "dotenv";
import { parseSnapshotSheet, songManifestSchema } from "./shared/song-snapshot";
import { defaultIllustrationId, promptFolder, sanitizePathSegment } from "../src/lib/song-ids";
import { readD1Config } from "./shared/d1-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERBOSE = false;
const SYSTEM_EMAIL = "domho108@gmail.com";

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

type Environment = "dev" | "staging" | "prod";

function parseEnvironment(): Environment {
  const args = process.argv.slice(2);
  if (args.includes("--prod")) return "prod";
  if (args.includes("--staging")) return "staging";
  if (args.includes("--dev")) return "dev";

  console.error(
    "❌ No environment flag provided. Use --dev, --staging, or --prod.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Snapshot seed
// ---------------------------------------------------------------------------

/**
 * Creates or gets the system user for migrations
 */
async function ensureSystemUser(db: AppDatabase): Promise<string> {
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
async function clearTables(db: AppDatabase) {
  console.log("Clearing tables...");
  await withVersionMaintenance(db, async () => {
    await db.update(song).set({ currentVersionId: null, currentIllustrationId: null });
    await db.update(songVersion).set({ parentId: null, mergedIntoVersionId: null });
    for (const table of [syncSession, userFavoriteSongs, songRevision, songSubmission,
      songIllustration, illustrationPrompt, songVersion, song, songImport]) {
      await db.delete(table);
    }
  });
}

function readSongFolder(folder: string, songId: string) {
  const manifestPath = path.join(folder, "song.yaml");
  if (!fs.existsSync(manifestPath)) {
    if (fs.readdirSync(folder).some(file => file.endsWith(".pro"))) {
      throw new Error("Missing song.yaml in " + folder);
    }
    return null;
  }
  const manifest = songManifestSchema.parse(yaml.load(fs.readFileSync(manifestPath, "utf8")));
  if (manifest.songId !== songId) throw new Error("Song ID mismatch: " + manifestPath);
  const expected = new Set(Object.keys(manifest.versions).map(name => `${name}.pro`));
  if (fs.readdirSync(folder).some(file => file.endsWith(".pro") && !expected.has(file))) {
    throw new Error("Unlisted sheet in " + folder);
  }
  const versions = Object.entries(manifest.versions).map(([name, version]) => {
    const sheet = parseSnapshotSheet(fs.readFileSync(path.join(folder, `${name}.pro`), "utf8"));
    return {
      ...sheet, ...version, name,
      createdAt: new Date(version.createdAt), updatedAt: new Date(version.updatedAt),
    };
  });
  const official = versions.find(version => version.name === manifest.official)!;
  const activeIllustration = official.metadata.illustrationId;
  if (activeIllustration && !manifest.prompts.some(prompt => prompt.illustrations.some(ill =>
    activeIllustration === `${prompt.id}_${ill.imageModel}` ||
    activeIllustration === defaultIllustrationId(prompt.id, ill.imageModel),
  ))) throw new Error("Unknown active illustration in " + manifestPath);
  return { songId, official, versions, prompts: manifest.prompts };
}

/**
 * Uploads illustrations for a song
 */
async function uploadIllustrations(
  db: AppDatabase,
  songId: string,
  prompts: NonNullable<ReturnType<typeof readSongFolder>>["prompts"],
  activeIllustration: string | undefined,
  baseFolder: string,
  logger: (msg: string) => void,
) {
  logger(`  [DEBUG] Reading illustrations YAML for ${songId}...`);
  for (const prompt of prompts) {
    logger(`  [DEBUG] Inserting 'illustrationPrompt' ID: ${prompt.id}`);
    await db.insert(illustrationPrompt).values({
      id: prompt.id,
      songId,
      text: prompt.text,
      summaryModel: prompt.summaryModel,
      summaryPromptVersion: prompt.summaryPromptVersion,
      createdAt: prompt.createdAt instanceof Date ? prompt.createdAt : new Date(prompt.createdAt ?? 0),
    });

    for (const ill of prompt.illustrations) {
      const illustrationId = activeIllustration === defaultIllustrationId(prompt.id, ill.imageModel)
        ? activeIllustration
        : `${prompt.id}_${ill.imageModel}`;
      const shortPromptId = sanitizePathSegment(promptFolder(songId, prompt.id));

      logger(`  [DEBUG] Inserting 'songIllustration' ID: ${illustrationId}`);
      await db.insert(songIllustration).values({
        id: illustrationId,
        songId,
        promptId: prompt.id,
        imageModel: ill.imageModel,
        imageURL: `${baseFolder}/${songId}/${shortPromptId}/full/${ill.filename}`,
        thumbnailURL: `${baseFolder}/${songId}/${shortPromptId}/thumbnail/${ill.filename}`,
        createdAt: ill.createdAt instanceof Date ? ill.createdAt : new Date(ill.createdAt),
      });
    }
  }
}

/**
 * Main Migration Logic
 */
export async function processAndMigrateSongs(
  db: AppDatabase,
  songsPath: string,
  clearExisting: boolean = true,
  baseFolder: string = "/songs",
) {
  const catalog = fs.readdirSync(songsPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => readSongFolder(path.join(songsPath, entry.name), entry.name))
    .filter(entry => entry !== null);
  if (!catalog.length) throw new Error("Refusing to seed an empty snapshot");
  const ids = catalog.flatMap(entry => entry.versions.map(version => version.id));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate version ID in snapshot");

  const systemUserId = await ensureSystemUser(db);
  if (clearExisting) await clearTables(db);

  console.log("Processing " + catalog.length + " songs...");
  for (const { songId, official, versions, prompts } of catalog) {
    const logger = VERBOSE ? console.log : () => {};
    await db.insert(song).values({
      id: songId, createdAt: official.createdAt, updatedAt: official.updatedAt,
    });
    for (const { id, metadata, chordpro, createdAt, updatedAt, label, description, youtubeId, revision } of versions) {
      await db.insert(songVersion).values({
        id, songId, chordpro, createdAt, updatedAt,
        title: metadata.title, artist: metadata.artist,
        key: metadata.key || null, language: metadata.language || "other",
        capo: parseInt(metadata.capo) || 0, tempo: metadata.tempo || null,
        range: metadata.range || null, startMelody: metadata.startMelody || null,
        label: label ?? null, description: description ?? null,
        youtubeId: youtubeId ?? null, revision,
        userId: systemUserId, approvedBy: systemUserId, approvedAt: createdAt,
        status: "published",
      });
    }
    await uploadIllustrations(db, songId, prompts, official.metadata.illustrationId, baseFolder, logger);
    await db.update(song).set({
      currentVersionId: official.id,
      currentIllustrationId: official.metadata.illustrationId || null,
    }).where(eq(song.id, songId));
    await db.insert(userFavoriteSongs).values({ userId: systemUserId, songId });
  }
  console.log("✅ Migration complete!");
}

// ---------------------------------------------------------------------------
// Environment-specific runners
// ---------------------------------------------------------------------------

/**
 * Prompts the user for confirmation via stdin.
 * @param message  The question to display (should include [Y/n] or [y/N]).
 * @param defaultYes  If true, an empty/Enter reply is treated as "yes".
 * @returns true if the user confirmed, false otherwise.
 */
async function confirm(message: string, defaultYes: boolean): Promise<boolean> {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(message + " ", (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") return resolve(defaultYes);
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

async function runDev(songsPath: string) {
  console.log("🛠️  Running migration against LOCAL D1...");
  const { D1Helper } = await import("@nerdfolio/drizzle-d1-helpers");
  await D1Helper.get("DB").useLocalD1((db) =>
    processAndMigrateSongs(db as unknown as AppDatabase, songsPath),
  );
}

/**
 * Reads wrangler.jsonc and extracts the D1 database_id and database_name
 * for the given environment ("staging" = env.staging.d1_databases, prod = top-level).
 */
function getD1ConfigFromWrangler(env: "staging" | "prod"): {
  databaseId: string;
  databaseName: string;
} {
  const wranglerPath = path.resolve(__dirname, "../wrangler.jsonc");
  return readD1Config(fs.readFileSync(wranglerPath, "utf8"), env);
}

async function runStaging(songsPath: string) {
  const accountId = process.env.STAGING_CF_ACCOUNT_ID || process.env["staging.CF_ACCOUNT_ID"];
  const token = process.env.STAGING_CF_D1_TOKEN || process.env["staging.CF_D1_TOKEN"];

  if (!accountId || !token) {
    console.error(
      "❌ Missing staging credentials. Ensure STAGING_CF_ACCOUNT_ID " +
        "and STAGING_CF_D1_TOKEN are set in your .dev.vars.",
    );
    process.exit(1);
  }

  const { databaseId, databaseName } = getD1ConfigFromWrangler("staging");

  console.log(`🔶 Target:  STAGING D1  (${databaseName})`);
  console.log(`   DB ID:   ${databaseId}`);

  // Default YES — press Enter to proceed
  const ok = await confirm("Proceed? [Y/n]", true);
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("Running migration...");
  const { useProxyD1: withProxyD1 } = await import("@nerdfolio/drizzle-d1-helpers");
  await withProxyD1({ accountId, token, databaseId }, async (db) =>
    processAndMigrateSongs(db as unknown as AppDatabase, songsPath),
  );
}

async function runProd(songsPath: string) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !token) {
    console.error(
      "❌ Missing production credentials. Ensure CF_ACCOUNT_ID and " +
        "CLOUDFLARE_D1_TOKEN are set in your environment.",
    );
    process.exit(1);
  }

  const { databaseId, databaseName } = getD1ConfigFromWrangler("prod");

  console.log(`🚨 Target:  PRODUCTION D1  (${databaseName})`);
  console.log(`   DB ID:   ${databaseId}`);

  // Default NO — must explicitly type "y"
  const ok = await confirm("Proceed? [y/N]", false);
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("Running migration...");
  const { useProxyD1: withProxyD1 } = await import("@nerdfolio/drizzle-d1-helpers");
  await withProxyD1({ accountId, token, databaseId }, async (db) =>
    processAndMigrateSongs(db as unknown as AppDatabase, songsPath),
  );
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main() {
  config({ path: path.resolve(__dirname, "../.dev.vars") });
  const env = parseEnvironment();
  const songsPath = path.resolve(__dirname, "../songs");

  console.log(`\n📦 staticData2DB — environment: ${env.toUpperCase()}\n`);

  try {
    if (env === "dev") await runDev(songsPath);
    else if (env === "staging") await runStaging(songsPath);
    else await runProd(songsPath);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
