import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import fs from "fs";
import yaml from "js-yaml";
import makeHash from "object-hash";
import path from "path";
import { user } from "../src/lib/db/schema/auth.schema";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songVersion,
} from "../src/lib/db/schema/song.schema";
import { SongData } from "../src/web/types/songData";

export const preambleKeywords = [
  "title",
  "artist",
  "songbooks",
  "key",
  "date_added",
  "language",
  "tempo",
  "capo",
  "range",
  "start_melody",
  "prompt_model",
  "prompt_id",
  "image_model",
  "pdf_filenames",
];

export const JS2chordproKeywords = {
  title: "title",
  artist: "artist",
  songbooks: "songbooks",
  key: "key",
  dateAdded: "date_added",
  language: "language",
  tempo: "tempo",
  capo: "capo",
  range: "range",
  startMelody: "start_melody",
  promptModel: "prompt_model",
  promptId: "prompt_id",
  imageModel: "image_model",
  pdfFilenames: "pdf_filenames",
};

export const chordpro2JSKeywords = Object.fromEntries(
  Object.entries(JS2chordproKeywords).map(([key, value]) => [value, key])
);

interface SongEntry {
  title: string;
  artist: string;
  key?: string;
  language?: string;
  chordproFile: string;
  contentHash: string;
  startMelody?: string;
  tempo?: number;
  capo?: string | number;
  range?: string;
  dateAdded?: string;
  availableIllustrations: string;
  promptModel?: string;
  promptVersion?: string;
  imageModel?: string;
  chordproContent: string; // Store the cleaned content
  disabled?: boolean;
  [key: string]: any; // For other preamble fields
}

interface PromptEntry {
  model: string;
  prompt_id: string;
  response: string;
}

// Default system user ID for migration
const SYSTEM_USER_ID = process.env.DOMCZIK_USER_ID;

function songId(title: string, artist: string): string {
  return SongData.baseId(title, artist);
}

function parseDateToTimestamp(dateStr: string): Date {
  const [month, year] = dateStr.split("-");
  const parsedMonth = parseInt(month);
  const parsedYear = parseInt(year);

  if (
    isNaN(parsedMonth) ||
    isNaN(parsedYear) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    console.warn(`Invalid date format: ${dateStr}, using current date`);
    return new Date();
  }

  return new Date(parsedYear, parsedMonth - 1);
}

function extractPreamble(
  content: string,
  keywords: string[]
): Record<string, string> {
  const preamble: Record<string, string> = {};
  keywords.forEach((keyword) => {
    const match = content.match(new RegExp(`{${keyword}:\\s*(.+?)}`, "i"));
    preamble[chordpro2JSKeywords[keyword]] = match?.[1].trim() || "";
  });
  return preamble;
}

function removePreamble(content: string, keywords: string[]): string {
  // Remove all ChordPro directives (lines starting with { and ending with })
  // but preserve the song content (chords and lyrics)
  const keywordRegexPart = keywords
    .map((k) => k + "|")
    .join("")
    .slice(0, -1);
  const keywordRegex = new RegExp(`{(${keywordRegexPart}):\\s*(.+?)}`, "i");
  return content
    .split("\n")
    .filter((line) => !line.trim().match(keywordRegex))
    .join("\n")
    .trim();
}

function loadPromptData(songsPath: string, songId: string): PromptEntry[] {
  const promptFilePath = `${songsPath}/image_prompts/${songId}.yaml`;

  if (!fs.existsSync(promptFilePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(promptFilePath, "utf8");
    const prompts = yaml.load(content) as PromptEntry[];

    if (!Array.isArray(prompts)) {
      console.warn(`Invalid prompt file format for ${songId}: expected array`);
      return [];
    }

    return prompts;
  } catch (error) {
    console.warn(`Failed to load prompt file for ${songId}:`, error);
    return [];
  }
}

function loadSongData(songsPath = "../songs"): SongEntry[] {
  const files = fs
    .readdirSync(`${songsPath}/chordpro`)
    .filter((file) => file.endsWith(".pro") || file.endsWith(".chordpro"));

  const songDB = files.map((chordproFile) => {
    const content =
      fs.readFileSync(`${songsPath}/chordpro/${chordproFile}`, "utf8") || "";
    const preamble = extractPreamble(content, preambleKeywords);
    const disabled =
      content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === "true" || false;
    const contentHash = makeHash(content);

    // Remove directives to get clean chordpro content
    const cleanedContent = removePreamble(content, preambleKeywords);

    // Get the filename without extension for illustrations folder check
    const filenameWithoutExt = chordproFile.replace(/\.(pro|chordpro)$/, "");

    // Check for illustrations in the corresponding folder
    const illustrationsPath = `${songsPath}/illustrations/${filenameWithoutExt}`;
    let availableIllustrations: string[] = [];

    // Check if the illustrations directory exists
    if (
      fs.existsSync(illustrationsPath) &&
      fs.statSync(illustrationsPath).isDirectory()
    ) {
      // Get all files in the illustrations directory
      const illustrationFiles = fs.readdirSync(illustrationsPath);

      // Extract filenames without extensions
      availableIllustrations = illustrationFiles.map((file) => {
        const ext = path.extname(file);
        return file.substring(0, file.length - ext.length);
      });
    }

    const songData = {
      ...preamble,
      chordproFile,
      contentHash,
      chordproContent: cleanedContent,
      availableIllustrations: JSON.stringify(availableIllustrations),
      disabled,
    } as SongEntry;

    return songData;
  });

  // Filter out disabled songs
  return songDB.filter((entry) => !entry.disabled);
}

async function insertSongRecord(
  db: DrizzleD1Database,
  songId: string,
  now: Date
): Promise<void> {
  // Insert song record WITHOUT foreign key references initially
  const songData = {
    id: songId,
    // Leave these null for now - will update after creating versions/illustrations
    currentVersionId: null as any, // Temporary null
    currentIllustrationId: null as any, // Temporary null
    createdAt: now,
    updatedAt: now,
    hidden: false,
    deleted: false,
  };

  await db.insert(song).values(songData).onConflictDoUpdate({
    target: song.id,
    set: songData,
  });
}

async function updateSongReferences(
  db: DrizzleD1Database,
  songId: string,
  currentVersionId: string,
  currentIllustrationId: string | null,
  now: Date
): Promise<void> {
  // Update the song record with the current references
  const updateData: any = {
    currentVersionId,
    updatedAt: now,
  };

  if (currentIllustrationId) {
    updateData.currentIllustrationId = currentIllustrationId;
  }

  await db.update(song).set(updateData).where(eq(song.id, songId));
}

async function insertSongVersion(
  db: DrizzleD1Database,
  entry: SongEntry,
  songId: string,
  now: Date
): Promise<string> {
  const versionId = `${songId}_${Date.now()}`; // Initial version

  const versionData = {
    id: versionId,
    songId,
    title: entry.title,
    artist: entry.artist,
    key: entry.key || null,
    language: entry.language ?? "other",
    capo: entry.capo ? parseInt(entry.capo.toString()) : null,
    range: entry.range || null,
    startMelody: entry.startMelody || null,
    tempo: entry.tempo ? entry.tempo.toString() : null,
    userId: SYSTEM_USER_ID,
    approved: true, // Auto-approve system migrations
    approvedBy: SYSTEM_USER_ID,
    approvedAt: now,
    createdAt: entry.dateAdded ? parseDateToTimestamp(entry.dateAdded) : now,
    updatedAt: now,
    chordpro: entry.chordproContent,
  };

  await db.insert(songVersion).values(versionData).onConflictDoUpdate({
    target: songVersion.id,
    set: versionData,
  });

  return versionId;
}

async function insertIllustrationPrompts(
  db: DrizzleD1Database,
  songId: string,
  prompts: PromptEntry[]
): Promise<void> {
  for (const prompt of prompts) {
    const promptId = `${songId}_${prompt.model}_${prompt.prompt_id}`;

    const promptData = {
      id: promptId,
      songId,
      summaryPromptVersion: prompt.prompt_id,
      summaryModel: prompt.model,
      text: prompt.response,
    };
    try {
      await db
        .insert(illustrationPrompt)
        .values(promptData)
        .onConflictDoUpdate({
          target: illustrationPrompt.id,
          set: promptData,
        });
    } catch (err) {
      console.error(`Failed to insert prompt ${promptId}:`, err);
    }
  }
}

function parseIllustrations(illustrationsStr: string): string[] {
  if (!illustrationsStr) return [];

  try {
    const parsed = JSON.parse(illustrationsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Failed to parse illustrations: ${illustrationsStr}`);
    return [];
  }
}

function determineActiveModel(
  entry: SongEntry,
  illustrations: string[]
): string | undefined {
  if (entry.promptModel || entry.promptVersion || entry.imageModel) {
    const composite = `${entry.promptModel || "gpt-4o-mini"}_${
      entry.promptVersion || "v1"
    }_${entry.imageModel || "FLUX.1-dev"}`;

    const found = illustrations.find((m) => m === composite);
    if (found) return found;
  }

  const preferredModels = [
    "gpt-4o-mini_v2_FLUX.1-dev",
    "gpt-4o-mini_v1_FLUX.1-dev",
  ];

  for (const preferred of preferredModels) {
    if (illustrations.includes(preferred)) {
      return preferred;
    }
  }

  return undefined;
}

function parseModelString(
  model: string
): { promptModel: string; promptVersion: string; imageModel: string } | null {
  const parts = model.split("_");
  if (parts.length !== 3) {
    console.warn(`Invalid model format: ${model}`);
    return null;
  }

  return {
    promptModel: parts[0],
    promptVersion: parts[1],
    imageModel: parts[2],
  };
}

async function insertIllustrations(
  db: DrizzleD1Database,
  songId: string,
  illustrations: string[],
  activeModel: string | undefined,
  prompts: PromptEntry[],
  now: Date
): Promise<string | null> {
  let activeIllustrationId: string | null = null;

  for (const model of illustrations) {
    const modelInfo = parseModelString(model);
    if (!modelInfo) continue;

    const { promptModel, promptVersion, imageModel } = modelInfo;
    // Find matching prompt if it exists
    const matchingPrompt = prompts.find(
      (p) => p.model === promptModel && p.prompt_id === promptVersion
    );

    if (!matchingPrompt) {
      console.warn(
        `Matching prompt not found for ${model} in song ${songId}, skipping illustration`
      );
      console.log(modelInfo, prompts);
      continue;
    }

    // Determine source type and prompt reference
    const compositeName = `${promptModel}_${promptVersion}_${imageModel}`;
    const illustrationId = `${songId}_${compositeName}`;
    const promptRef = `${songId}_${promptModel}_${promptVersion}`;

    const illustrationData = {
      id: illustrationId,
      songId,
      promptId: promptRef,
      imageModel,
      imageURL: `/songs/illustrations/${songId}/${compositeName}.webp`,
      thumbnailURL: `/songs/illustrations_thumbnails/${songId}/${compositeName}.webp`,
      commonR2Key: null, // Set to null for file-based storage
      createdAt: now,
    };

    try {
      await db
        .insert(songIllustration)
        .values(illustrationData)
        .onConflictDoUpdate({
          target: songIllustration.id,
          set: illustrationData,
        });

      // Set the active illustration ID
      if (model === activeModel) {
        activeIllustrationId = illustrationId;
      }
    } catch (err) {
      console.error(
        `Failed to insert illustration ${illustrationId} for song ${songId}\n`,
        illustrationData,
        err
      );
    }
  }

  return activeIllustrationId;
}

async function processAndMigrateSongs(
  db: DrizzleD1Database,
  songsPath = "../songs",
  saveBackup = false
): Promise<void> {
  if (!SYSTEM_USER_ID) {
    throw new Error("DOMCZIK_USER_ID environment variable is required");
  }

  console.log("Adding system user to DB...");
  try {
    await db
      .insert(user)
      .values({
        id: SYSTEM_USER_ID,
        name: "SYSTEM USER",
        email: "system@user.eu",
      })
      .onConflictDoNothing();
    console.log("System user added successfully");
  } catch (err) {
    console.warn("Failed to add system user:", err);
  }

  console.log("Loading song data from files...");
  const songDB = loadSongData(songsPath);
  console.log(`Loaded ${songDB.length} songs from files`);

  // Optionally save backup files
  if (saveBackup) {
    console.log("Saving backup files...");
    const hash = makeHash(songDB);

    fs.mkdir("public", { recursive: true }, (err) => {
      if (err) console.warn("Could not create public directory:", err);
    });

    try {
      fs.writeFileSync("public/songDB.json", JSON.stringify(songDB, null, 2));
      fs.writeFileSync("public/songDB.hash", hash);
      console.log("Backup files saved to public/ directory");
    } catch (err) {
      console.warn("Could not save backup files:", err);
    }
  }

  // Migrate to D1 database
  console.log("Starting database migration...");
  const now = new Date();
  let successCount = 0;
  let errorCount = 0;

  for (const entry of songDB) {
    if (!entry.title || !entry.artist) {
      console.warn(
        "Skipping entry with missing title or artist:",
        entry.chordproFile
      );
      errorCount++;
      continue;
    }

    const id = songId(entry.title, entry.artist);

    try {
      // Step 1: Insert song record without foreign key references
      await insertSongRecord(db, id, now);

      // Step 2: Load and insert prompts for this song
      const prompts = loadPromptData(songsPath, id);
      if (prompts.length > 0) {
        await insertIllustrationPrompts(db, id, prompts);
      }

      // Step 3: Insert song version
      const currentVersionId = await insertSongVersion(db, entry, id, now);

      // Step 4: Handle illustrations
      let currentIllustrationId: string | null = null;
      const illustrations = parseIllustrations(entry.availableIllustrations);

      if (illustrations.length > 0) {
        const activeModel = determineActiveModel(entry, illustrations);

        if (!activeModel) {
          console.warn(
            `⚠️ No preferred active illustration for "${entry.title}" by ${entry.artist}`
          );
        }

        currentIllustrationId = await insertIllustrations(
          db,
          id,
          illustrations,
          activeModel,
          prompts,
          now
        );
      }

      // Step 5: Update song record with foreign key references
      if (currentIllustrationId) {
        await updateSongReferences(
          db,
          id,
          currentVersionId,
          currentIllustrationId,
          now
        );
      } else {
        // If no illustrations, just update with version ID
        await updateSongReferences(db, id, currentVersionId, null, now);
        console.warn(
          `Song "${entry.title}" by ${entry.artist} has no illustrations`
        );
      }

      successCount++;
    } catch (err) {
      console.error(
        `Failed to process song "${entry.title}" by ${entry.artist}:`,
        err
      );
      errorCount++;
    }
  }

  console.log(
    `✅ Migration complete: ${successCount} successful, ${errorCount} errors`
  );
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");

    // Parse command line arguments
    const saveBackup =
      process.argv.includes("--save-backup") || process.argv.includes("-b");
    const songsPath =
      process.argv
        .find((arg) => arg.startsWith("--songs-path="))
        ?.split("=")[1] || "../songs";

    if (saveBackup) {
      console.log("Backup files will be saved to public/ directory");
    }

    await helper.useLocalD1(async (db) =>
      processAndMigrateSongs(db, songsPath, saveBackup)
    );
  } catch (err) {
    console.error("Failed to execute migration:", err);
    process.exit(1);
  }
}

main();

// To run, use: npx tsx --env-file-if-exists=.dev.vars scripts/populateSongDB.ts --songs-path="songs"
// To delete previous data run: npx wrangler d1 execute zpevnik --local --file scripts/wipeSongs.sql

// to get it to prod:
// npx wrangler d1 export zpevnik --local --table=song --output=songs.sql
// npx wrangler d1 export zpevnik --local --table=song_version --output=versions.sql
// npx wrangler d1 export zpevnik --local --table=illustration_prompt --output=prompts.sql
// npx wrangler d1 export zpevnik --local --table=song_illustration --output=illustrations.sql

// npx wrangler d1 execute zpevnik --remote --file scripts/wipeSongs.sql --yes
// npx wrangler d1 execute zpevnik --remote --file=songs.sql --yes
// npx wrangler d1 execute zpevnik --remote --file=versions.sql --yes
// // this one for some reason does not 
// npx wrangler d1 execute zpevnik --remote --file=prompts.sql --yes
// npx wrangler d1 execute zpevnik --remote --file=illustrations.sql --yes

export { loadSongData, processAndMigrateSongs };