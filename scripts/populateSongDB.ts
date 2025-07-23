import fs from 'fs';
import makeHash from 'object-hash';
import path from 'path';
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { song, songIllustration } from "../src/lib/db/schema/song.schema";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { preambleKeywords, chordpro2JSKeywords } from "../src/web/types/preambleKeywords.js";
import { validateMetadataDefinitions, validateSongObject } from '../src/web/types/metadata-validator.js';

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

function to_ascii(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function songId(title: string, artist: string): string {
  return `${to_ascii(artist)}-${to_ascii(title)}`
    .replace(/ /g, "_")
    .replace(/[^A-Za-z0-9-_]+/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function parseDateToTimestamp(dateStr: string): Date {
  const [month, year] = dateStr.split("-");
  const parsedMonth = parseInt(month);
  const parsedYear = parseInt(year);
  
  if (isNaN(parsedMonth) || isNaN(parsedYear) || parsedMonth < 1 || parsedMonth > 12) {
    console.warn(`Invalid date format: ${dateStr}, using current date`);
    return new Date();
  }
  
  return new Date(parsedYear, parsedMonth - 1);
}

function extractPreamble(content: string, keywords: string[]): Record<string, string> {
  const preamble: Record<string, string> = {};
  keywords.forEach(keyword => {
    const match = content.match(new RegExp(`{${keyword}:\\s*(.+?)}`, 'i'));
    preamble[chordpro2JSKeywords[keyword]] = match?.[1].trim() || "";
  });
  return preamble;
}

function loadSongData(songsPath = '../songs'): SongEntry[] {
  const files = fs.readdirSync(`${songsPath}/chordpro`).filter(file => 
    file.endsWith('.pro') || file.endsWith('.chordpro')
  );

  let songDB = files.map(chordproFile => {
    const content = fs.readFileSync(`${songsPath}/chordpro/${chordproFile}`, 'utf8') || "";
    const preamble = extractPreamble(content, preambleKeywords);
    const disabled = (content.match(/{disabled:\s*(.+?)}/i)?.[1].trim() === 'true') || false;
    const contentHash = makeHash(content);

    // Get the filename without extension for illustrations folder check
    const filenameWithoutExt = chordproFile.replace(/\.(pro|chordpro)$/, '');

    // Check for illustrations in the corresponding folder
    const illustrationsPath = `${songsPath}/illustrations/${filenameWithoutExt}`;
    let availableIllustrations: string[] = [];

    // Check if the illustrations directory exists
    if (fs.existsSync(illustrationsPath) && fs.statSync(illustrationsPath).isDirectory()) {
      // Get all files in the illustrations directory
      const illustrationFiles = fs.readdirSync(illustrationsPath);

      // Extract filenames without extensions
      availableIllustrations = illustrationFiles.map(file => {
        const ext = path.extname(file);
        return file.substring(0, file.length - ext.length);
      });
    }

    const songData = {
      ...preamble,
      chordproFile,
      contentHash,
      availableIllustrations: JSON.stringify(availableIllustrations),
      disabled
    } as SongEntry & { disabled: boolean };

    return songData;
  });

  // Filter out disabled songs
  songDB = songDB.filter(m => !m.disabled);

  // Remove the disabled field from all song objects
  return songDB.map(({ disabled, ...rest }) => rest as SongEntry);
}

async function insertSongRecord(db: DrizzleD1Database, entry: SongEntry, id: string, now: Date): Promise<void> {
  const songData = {
    id,
    title: entry.title,
    artist: entry.artist,
    key: entry.key ?? "C",
    createdAt: entry.dateAdded ? parseDateToTimestamp(entry.dateAdded) : now,
    modifiedAt: now,
    startMelody: entry.startMelody || null,
    language: entry.language ?? "unknown",
    tempo: entry.tempo || null,
    capo: entry.capo ? parseInt(entry.capo.toString()) : 0,
    range: entry.range || null,
    chordproURL: `/songs/chordpro/${entry.chordproFile}`,
    hidden: false
  };

  await db
    .insert(song)
    .values(songData)
    .onConflictDoUpdate({
      target: song.id,
      set: songData,
    });
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

function determineActiveModel(entry: SongEntry, illustrations: string[]): string | undefined {
  if (entry.promptModel || entry.promptId || entry.imageModel) {
    const composite = `${entry.promptModel || "gpt-4o-mini"}_${
      entry.promptId || "v1"
    }_${entry.imageModel || "FLUX.1-dev"}`;
    
    const found = illustrations.find((m) => m === composite);
    if (found) return found;
  }

  const preferredModels = [
    "gpt-4o-mini_v2_FLUX.1-dev",
    "gpt-4o-mini_v1_FLUX.1-dev"
  ];

  for (const preferred of preferredModels) {
    if (illustrations.includes(preferred)) {
      return preferred;
    }
  }

  return undefined;
}

function parseModelString(model: string): { promptModel: string; promptId: string; imageModel: string } | null {
  const parts = model.split("_");
  if (parts.length !== 3) {
    console.warn(`Invalid model format: ${model}`);
    return null;
  }
  
  return {
    promptModel: parts[0],
    promptId: parts[1],
    imageModel: parts[2]
  };
}

async function insertIllustrations(
  db: DrizzleD1Database, 
  songId: string, 
  illustrations: string[], 
  activeModel: string | undefined, 
  now: Date
): Promise<void> {
  for (const model of illustrations) {
    const modelInfo = parseModelString(model);
    if (!modelInfo) continue;

    const { promptModel, promptId, imageModel } = modelInfo;
    const compositeName = `${promptModel}_${promptId}_${imageModel}`;
    const illustrationId = `${songId}_${compositeName}`;
    
    const illustrationData = {
      id: illustrationId,
      songId,
      promptModel,
      promptId,
      imageModel,
      imageURL: `/songs/illustrations/${songId}/${compositeName}.webp`,
      thumbnailURL: `/songs/illustrations_thumbnails/${songId}/${compositeName}.webp`,
      isActive: model === activeModel,
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
    } catch (err) {
      console.error(
        `Failed to insert illustration ${compositeName} for song ${songId}:`,
        err
      );
    }
  }
}

async function processAndMigrateSongs(
  db: DrizzleD1Database,
  songsPath = '../songs',
  saveBackup = false
): Promise<void> {
  // Validate metadata definitions first
  const validationResult = validateMetadataDefinitions();
  if (!validationResult.isValid) {
    console.error('METADATA DEFINITION ERRORS:');
    validationResult.errors.forEach(error => console.error(`- ${error}`));
    console.error('\nFix these errors before continuing!');
    throw new Error('Metadata validation failed');
  }

  console.log('Loading song data from files...');
  const songDB = loadSongData(songsPath);
  console.log(`Loaded ${songDB.length} songs from files`);

  // Validate each song object
  let validationWarnings = 0;
  songDB.forEach(songData => {
    const songValidation = validateSongObject(songData);
    if (!songValidation.isValid) {
      console.warn(`Warning: Issues with song "${songData.chordproFile}":`);
      songValidation.errors.forEach(error => console.warn(`  - ${error}`));
      validationWarnings++;
    }
  });

  if (validationWarnings > 0) {
    console.warn(`\n⚠️'  ${validationWarnings} songs had validation warnings\n`);
  }

  // Optionally save backup files
  if (saveBackup) {
    console.log('Saving backup files...');
    const hash = makeHash(songDB);
    
    fs.mkdir('public', { recursive: true }, (err) => {
      if (err) console.warn('Could not create public directory:', err);
    });

    try {
      fs.writeFileSync('public/songDB.json', JSON.stringify(songDB, null, 2));
      fs.writeFileSync('public/songDB.hash', hash);
      console.log('Backup files saved to public/ directory');
    } catch (err) {
      console.warn('Could not save backup files:', err);
    }
  }

  // Migrate to D1 database
  console.log('Starting database migration...');
  const now = new Date();
  let successCount = 0;
  let errorCount = 0;

  for (const entry of songDB) {
    if (!entry.title || !entry.artist) {
      console.warn("Skipping entry with missing title or artist:", entry.chordproFile);
      errorCount++;
      continue;
    }

    const id = songId(entry.title, entry.artist);
    
    try {
      await insertSongRecord(db, entry, id, now);

      const illustrations = parseIllustrations(entry.availableIllustrations);
      
      if (illustrations.length > 0) {
        const activeModel = determineActiveModel(entry, illustrations);
        
        if (!activeModel) {
          console.warn(`⚠️ No preferred active illustration for "${entry.title}" by ${entry.artist}`);
        }

        await insertIllustrations(db, id, illustrations, activeModel, now);
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

  console.log(`✅ Migration complete: ${successCount} successful, ${errorCount} errors`);
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");
    
    // Parse command line arguments
    const saveBackup = process.argv.includes('--save-backup') || process.argv.includes('-b');
    const songsPath = process.argv.find(arg => arg.startsWith('--songs-path='))?.split('=')[1] || '../songs';
    
    if (saveBackup) {
      console.log('Backup files will be saved to public/ directory');
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
// ro run, use: npx tsx scripts/populateSongDB.ts --songs-path="songs"
export { processAndMigrateSongs, loadSongData };