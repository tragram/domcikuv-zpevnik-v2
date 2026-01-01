import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import { SongData, illustrationBaseId } from "../src/web/types/songData";
import {
  AllIllustrationPromptsResponseData,
  BasicIllustrationPromptDB,
  BasicSongIllustrationDB,
  BasicSongIllustrationResponseData,
  SongDBResponseData,
} from "../src/worker/api/songDB";

import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Ensures a directory exists, creating it recursively if needed
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Downloads an image from a URL and returns the buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url.startsWith("/") ? BASE_URL + url : url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Checks if a file already exists and throws an error if it does
 */
function ensureNoOverwrite(filePath: string): void {
  if (fs.existsSync(filePath)) {
    throw new Error(
      `File already exists: ${filePath}. Please handle this duplicate manually.`
    );
  }
}

/**
 * Saves a single song's chordpro file
 */
function saveChordproFile(song: SongData, baseDir: string = "./songs"): void {
  const chordproDir = path.join(baseDir, "chordpro");
  ensureDirectoryExists(chordproDir);

  const filePath = path.join(chordproDir, `${song.id}.pro`);
  const chordproContent = song.toCustomChordpro();

  fs.writeFileSync(filePath, chordproContent, "utf-8");
  console.log(`Saved chordpro: ${filePath}`);
}

/**
 * Saves illustrations for a song based on prompts and illustration data
 */
async function saveIllustrations(
  song: SongData,
  prompts: BasicIllustrationPromptDB[],
  illustrations: BasicSongIllustrationDB[],
  baseDir: string = "./songs"
): Promise<void> {
  // Filter prompts and illustrations for this song
  const songPrompts = prompts.filter((p) => p.songId === song.id);
  const songIllustrations = illustrations.filter((i) => i.songId === song.id);

  if (songIllustrations.length === 0) {
    console.log(`No illustrations for song: ${song.id}`);
    return;
  }

  console.log(
    `Processing ${songIllustrations.length} illustrations for song: ${song.id}`
  );

  // Group illustrations by promptId
  const illustrationsByPrompt = new Map<
    string,
    Array<{
      imageModel: string;
      createdAt: number;
      filename: string;
    }>
  >();

  for (const illustration of songIllustrations) {
    // Find the corresponding prompt
    const prompt = songPrompts.find(
      (p) => p.promptId === illustration.promptId
    );
    if (!prompt) {
      console.warn(
        `Prompt not found for illustration: ${illustration.promptId}`
      );
      continue;
    }

    const filename = `${illustration.imageModel}.webp`;

    // Create directory structure: songs/illustrations/$songId/$promptId/full
    const fullDir = path.join(
      baseDir,
      "illustrations",
      song.id,
      illustration.promptId.replace(song.id + "_", ""),
      "full"
    );
    const thumbnailDir = path.join(
      baseDir,
      "illustrations",
      song.id,
      illustration.promptId.replace(song.id + "_", ""),
      "thumbnail"
    );

    ensureDirectoryExists(fullDir);
    ensureDirectoryExists(thumbnailDir);

    const fullPath = path.join(fullDir, filename);
    const thumbnailPath = path.join(thumbnailDir, filename);

    try {
      // Check for duplicates
      ensureNoOverwrite(fullPath);
      ensureNoOverwrite(thumbnailPath);

      // Save full image
      const fullImageBuffer = await downloadImage(illustration.imageURL);
      fs.writeFileSync(fullPath, fullImageBuffer);
      console.log(`  Saved full image: ${fullPath}`);

      // Save thumbnail
      const thumbnailImageBuffer = await downloadImage(
        illustration.thumbnailURL
      );
      fs.writeFileSync(thumbnailPath, thumbnailImageBuffer);
      console.log(`  Saved thumbnail: ${thumbnailPath}`);

      // Collect illustration data for metadata
      if (!illustrationsByPrompt.has(illustration.promptId)) {
        illustrationsByPrompt.set(illustration.promptId, []);
      }
      illustrationsByPrompt.get(illustration.promptId)!.push({
        createdAt: illustration.createdAt,
        imageModel: illustration.imageModel,
        filename,
      });
    } catch (error) {
      console.error(
        `Failed to save illustration ${illustration.promptId}/${illustration.imageModel}:`,
        error
      );
      throw error; // Re-throw to stop execution on duplicates
    }
  }

  // Build metadata structure with all prompts and their illustrations
  const metadata = {
    songId: song.id,
    prompts: songPrompts.map((prompt) => ({
      ...prompt,
      illustrations: (illustrationsByPrompt.get(prompt.promptId) || []).map(
        (ill) => ({
          ...ill,
        })
      ),
    })),
  };

  // Save single YAML file at song level
  const songIllustrationsDir = path.join(baseDir, "illustrations", song.id);
  const metadataPath = path.join(songIllustrationsDir, "illustrations.yaml");

  try {
    ensureNoOverwrite(metadataPath);
    fs.writeFileSync(metadataPath, yaml.dump(metadata), "utf-8");
    console.log(`  Saved metadata: ${metadataPath}`);
  } catch (error) {
    console.error(`Failed to save metadata for song ${song.id}:`, error);
    throw error;
  }
}

/**
 * Main function to save all songs with their illustrations
 */
async function saveSongs(
  songs: SongData[],
  prompts: AllIllustrationPromptsResponseData,
  illustrations: BasicSongIllustrationResponseData,
  baseDir: string = "./songs",
  options: {
    skipIllustrations?: boolean;
  } = {}
): Promise<void> {
  console.log(`\nSaving ${songs.length} songs to ${baseDir}...`);
  console.log(`Total prompts: ${prompts.length}`);
  console.log(`Total illustrations: ${illustrations.length}\n`);
  console.log(baseDir + "/chordpro")
  // fs.rmSync(baseDir + "/chordpro", { recursive: true, force: true });
  // fs.rmSync(baseDir + "/illustrations", { recursive: true, force: true });

  for (const song of songs) {
    try {
      console.log(
        `\nProcessing song: ${song.id} - "${song.title}" by ${song.artist}`
      );

      // Save chordpro file
      saveChordproFile(song, baseDir);

      // Save illustrations (which includes prompt metadata)
      if (!options.skipIllustrations) {
        await saveIllustrations(song, prompts, illustrations, baseDir);
      }
    } catch (error) {
      console.error(`\n❌ Error saving song ${song.id}:`, error);
      throw error; // Stop execution to handle duplicates manually
    }
  }

  console.log("\n✓ All songs saved successfully!");
}

/**
 * Makes an API request to the local server
 */
async function APIRequest<T>(
  endpoint: string,
  baseUrl: string = "http://localhost:5173"
): Promise<T> {
  const url = baseUrl + endpoint;
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return (await response.json()).data;
}

// const BASE_URL = "http://localhost:5173";
const BASE_URL = "https://zpevnik.hodan.page";

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("Fetching data from API...\n");

    const songs = (
      await APIRequest<SongDBResponseData>("/api/songs", BASE_URL)
    ).songs.map((d) => new SongData(d));

    const illustrations = await APIRequest<BasicSongIllustrationResponseData>(
      "/api/songs/illustrations",
      BASE_URL
    );
    const prompts = await APIRequest<AllIllustrationPromptsResponseData>(
      "/api/songs/prompts",
      BASE_URL
    );

    console.log(`\nFetched ${songs.length} songs`);
    console.log(`Fetched ${prompts.length} prompts`);
    console.log(`Fetched ${illustrations.length} illustrations\n`);

    const songsPath = path.resolve(__dirname, "../songs");
    await saveSongs(songs, prompts, illustrations, songsPath, {
      skipIllustrations: false,
    });
  } catch (error) {
    console.error("Error in main:", error);
    process.exit(1);
  }
}

// Export functions for use in other modules
export { saveSongs, saveChordproFile, saveIllustrations };

// Run main function
main().catch(console.error);
