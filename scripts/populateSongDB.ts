import fs from "fs";
import makeHash from "object-hash";
import path from "path";
import yaml from "js-yaml";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import {
  song,
  songIllustration,
  illustrationPrompt,
} from "../src/lib/db/schema/song.schema";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import {
  preambleKeywords,
  chordpro2JSKeywords,
} from "../src/web/types/preambleKeywords.js";
import {
  validateMetadataDefinitions,
  validateSongObject,
} from "../src/web/types/metadata-validator.js";

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
  promptId?: string;
  imageModel?: string;
  [key: string]: any; // For other preamble fields
}

interface PromptEntry {
  model: string;
  prompt_id: string;
  response: string;
}

function to_ascii(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function songId(title: string, artist: string): string {
  return SongData.id(title, artist);
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

  let songDB = files.map((chordproFile) => {
    const content =
      fs.readFileSync(`${songsPath}/chordpro/${chordproFile}`, "utf8") || "";
    const preamble = extractPreamble(content, preambleKeywords);
    const disabled =
      content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === "true" || false;
    const contentHash = makeHash(content);

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
      availableIllustrations: JSON.stringify(availableIllustrations),
      disabled,
    } as SongEntry & { disabled: boolean };

    return songData;
  });

  // Filter out disabled songs
  songDB = songDB.filter((m) => !m.disabled);

  // Remove the disabled field from all song objects
  return songDB.map(({ disabled, ...rest }) => rest as SongEntry);
}

import { SongData } from "../src/web/types/songData";

async function insertSongRecord(
  db: DrizzleD1Database,
  entry: SongEntry,
  id: string,
  now: Date
): Promise<void> {
  const songData = {
    id,
    title: entry.title,
    artist: entry.artist,
    key: entry.key ?? "C",
    createdAt: entry.dateAdded ? parseDateToTimestamp(entry.dateAdded) : now,
    updatedAt: now,
    startMelody: entry.startMelody || null,
    language: entry.language ?? "unknown",
    tempo: entry.tempo || null,
    capo: entry.capo ? parseInt(entry.capo.toString()) : 0,
    range: entry.range || null,
    chordproURL: `/songs/chordpro/${id}.pro`,
    hidden: false,
  };
  await db.insert(song).values(songData).onConflictDoUpdate({
    target: song.id,
    set: songData,
  });
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
      summaryPromptId: prompt.prompt_id,
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
  if (entry.promptModel || entry.promptId || entry.imageModel) {
    const composite = `${entry.promptModel || "gpt-4o-mini"}_${
      entry.promptId || "v1"
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
): { promptModel: string; promptId: string; imageModel: string } | null {
  const parts = model.split("_");
  if (parts.length !== 3) {
    console.warn(`Invalid model format: ${model}`);
    return null;
  }

  return {
    promptModel: parts[0],
    promptId: parts[1],
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
): Promise<void> {
  for (const model of illustrations) {
    const modelInfo = parseModelString(model);
    if (!modelInfo) continue;

    const { promptModel, promptId, imageModel } = modelInfo;

    // Find matching prompt if it exists
    const matchingPrompt = prompts.find(
      (p) => p.model === promptModel && p.prompt_id === promptId
    );

    // Determine source type and prompt reference
    let sourceType: "summary" | "lyricsDirectly";
    let promptRef: string | null;
    const compositeName = `${promptModel}_${promptId}_${imageModel}`;
    const illustrationId = `${songId}_${compositeName}`;
    if (matchingPrompt) {
      sourceType = "summary";
      promptRef = `${songId}_${promptModel}_${promptId}`;
    } else {
      sourceType = "lyricsDirectly";
      promptRef = null;
    }

    const illustrationData = {
      id: illustrationId,
      songId,
      promptId: promptRef,
      sourceType,
      imageModel,
      imageURL: `/songs/illustrations/${songId}/${compositeName}.webp`,
      thumbnailURL: `/songs/illustrations_thumbnails/${songId}/${compositeName}.webp`,
      isActive: model === activeModel,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db
        .insert(songIllustration)
        .values(illustrationData)
        .onConflictDoUpdate({
          target: songIllustration.id,
          set: illustrationData,
        });
    } catch (err) {
      console.error(
        `Failed to insert illustration ${illustrationId} for song ${songId}:`,
        illustrationData,
        err
      );
    }
  }
}

async function processAndMigrateSongs(
  db: DrizzleD1Database,
  songsPath = "../songs",
  saveBackup = false
): Promise<void> {
  // Validate metadata definitions first
  const validationResult = validateMetadataDefinitions();
  if (!validationResult.isValid) {
    console.error("METADATA DEFINITION ERRORS:");
    validationResult.errors.forEach((error) => console.error(`- ${error}`));
    console.error("\nFix these errors before continuing!");
    throw new Error("Metadata validation failed");
  }

  console.log("Loading song data from files...");
  const songDB = loadSongData(songsPath);
  console.log(`Loaded ${songDB.length} songs from files`);

  // Validate each song object
  let validationWarnings = 0;
  songDB.forEach((songData) => {
    const songValidation = validateSongObject(songData);
    if (!songValidation.isValid) {
      console.warn(`Warning: Issues with song "${songData.chordproFile}":`);
      songValidation.errors.forEach((error) => console.warn(`  - ${error}`));
      validationWarnings++;
    }
  });

  if (validationWarnings > 0) {
    console.warn(`\n⚠️  ${validationWarnings} songs had validation warnings\n`);
  }

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
      await insertSongRecord(db, entry, id, now);

      // Load prompts for this song
      const prompts = loadPromptData(songsPath, id);

      // Insert prompts into database
      if (prompts.length > 0) {
        await insertIllustrationPrompts(db, id, prompts);
      }

      const illustrations = parseIllustrations(entry.availableIllustrations);

      if (illustrations.length > 0) {
        const activeModel = determineActiveModel(entry, illustrations);

        if (!activeModel) {
          console.warn(
            `⚠️ No preferred active illustration for "${entry.title}" by ${entry.artist}`
          );
        }

        await insertIllustrations(
          db,
          id,
          illustrations,
          activeModel,
          prompts,
          now
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
// To run, use: npx tsx scripts/populateSongDB.ts --songs-path="songs"
// To delete previous data run: npx wrangler d1 execute zpevnik --local --command "DELETE FROM song_illustration;DELETE FROM illustration_prompt;DELETE FROM song_version;"

export { processAndMigrateSongs, loadSongData };
