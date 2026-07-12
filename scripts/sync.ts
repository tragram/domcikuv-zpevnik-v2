import { PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../src/lib/db/schema";
import { SongData } from "../src/web/types/songData";
import { formatChordpro } from "../src/web/lib/formatChordpro";
import { db } from "./shared/remote-db";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";

export function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type DBBackup = {
  metadata: {
    version: string;
    database: string;
    createdAt: string;
    tables: string[];
  };
  tables: Record<string, unknown[]>;
};

// Per-illustration entry written into illustrations.yaml
type YamlIllustration = {
  createdAt: number;
  imageModel: string;
  filename: string;
};

async function main() {
  console.log(`Starting Sync...`);

  // ---------------------------------------------------------------------------
  // TASK 1: Backup D1 Database to R2 JSON
  // ---------------------------------------------------------------------------
  console.log("Starting D1 to R2 backup...");

  const backupData: DBBackup = {
    metadata: {
      version: "v0",
      database: "zpevnik",
      createdAt: new Date().toISOString(),
      tables: [],
    },
    tables: {},
  };
  // Ephemeral state — not worth backing up.
  const EXCLUDED_TABLES = ["session", "syncSession"];

  // The schema module also exports relations; keep only the actual tables.
  const tables = (Object.entries(schema) as [string, unknown][]).filter(
    (entry): entry is [string, SQLiteTable] => {
      const [key, value] = entry;
      return (
        !!value &&
        typeof value === "object" &&
        Symbol.for("drizzle:IsDrizzleTable") in value &&
        !EXCLUDED_TABLES.includes(key) // Skip the excluded tables
      );
    },
  );

  for (const [tableName, table] of tables) {
    const rows = await db.select().from(table);
    backupData.tables[tableName] = rows;
    backupData.metadata.tables.push(tableName);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `backups/db-backup-${timestamp}.json`,
      Body: JSON.stringify(backupData, null, 2),
      ContentType: "application/json",
    }),
  );
  console.log("✓ DB Backup completed.");

  // ---------------------------------------------------------------------------
  // TASK 2: Sync to GitHub (Local File Generation & Two-Way Sync Cleanup)
  // ---------------------------------------------------------------------------
  console.log("Fetching data for GitHub sync via Drizzle...");

  const songsQuery = db
    .select({
      id: schema.song.id,
      deleted: schema.song.deleted,
      hidden: schema.song.hidden,
      createdAt: schema.song.createdAt,
      updatedAt: schema.song.updatedAt,
      title: schema.songVersion.title,
      artist: schema.songVersion.artist,
      chordpro: schema.songVersion.chordpro,
      key: schema.songVersion.key,
      language: schema.songVersion.language,
      capo: schema.songVersion.capo,
      tempo: schema.songVersion.tempo,
      range: schema.songVersion.range,
      startMelody: schema.songVersion.startMelody,
      sourceId: schema.songImport.sourceId,
    })
    .from(schema.song)
    .leftJoin(
      schema.songVersion,
      and(
        eq(schema.songVersion.songId, schema.song.id),
        eq(schema.songVersion.status, "published"),
      ),
    )
    .leftJoin(
      schema.songImport,
      eq(schema.songImport.id, schema.songVersion.importId),
    );

  const promptsQuery = db.select().from(schema.illustrationPrompt);
  const illustrationsQuery = db.select().from(schema.songIllustration);

  const [songs, prompts, illustrations] = await Promise.all([
    songsQuery,
    promptsQuery,
    illustrationsQuery,
  ]);

  console.log(`Fetched: ${songs.length} songs, ${prompts.length} prompts.`);

  // --- IDENTIFY ACTIVE RECORDS ---
  const activeSongIds = new Set<string>();
  for (const songRow of songs) {
    // A song is active if it hasn't been deleted and isn't imported from an external source
    if (!songRow.sourceId && !songRow.deleted) {
      activeSongIds.add(songRow.id);
    }
  }

  // Folders still referenced by illustration URLs in the DB must never be
  // swept, even when their name doesn't match an active song id (historical
  // folders can use differently-cased ids; their static files are the only
  // remaining copy once the R2 original has been trashed by the cleanup job).
  const referencedIllustrationDirs = new Set<string>();
  const referencedPromptDirs = new Set<string>(); // "<songDir>/<promptDir>"
  for (const ill of illustrations) {
    if (ill.deleted) continue;
    for (const url of [ill.imageURL, ill.thumbnailURL]) {
      const match = url?.match(/^\/songs\/illustrations\/([^/]+)\/([^/]+)\//);
      if (match) {
        referencedIllustrationDirs.add(match[1]);
        referencedPromptDirs.add(`${match[1]}/${match[2]}`);
      }
    }
  }

  // --- CLEANUP ORPHANED LOCAL FILES ---
  console.log("Sweeping local directories for deleted records...");
  const proDir = path.join(process.cwd(), "songs/chordpro");
  const illustrationsBaseDir = path.join(process.cwd(), "songs/illustrations");

  if (fs.existsSync(proDir)) {
    for (const file of fs.readdirSync(proDir)) {
      if (file.endsWith(".pro")) {
        const songId = file.replace(".pro", "");
        if (!activeSongIds.has(songId)) {
          fs.unlinkSync(path.join(proDir, file));
          console.log(`Deleted orphaned chordpro: ${file}`);
        }
      }
    }
  }

  if (fs.existsSync(illustrationsBaseDir)) {
    for (const folder of fs.readdirSync(illustrationsBaseDir)) {
      if (folder.startsWith(".")) continue; // Ignore hidden files like .DS_Store
      if (!activeSongIds.has(folder) && !referencedIllustrationDirs.has(folder)) {
        fs.rmSync(path.join(illustrationsBaseDir, folder), {
          recursive: true,
          force: true,
        });
        console.log(`Deleted orphaned illustration folder for song: ${folder}`);
      }
    }
  }

  // --- PHASE C - GENERATE AND UPDATE ACTIVE RECORDS ---
  for (const songRow of songs) {
    // Skip entirely if it's not in our active set
    if (!activeSongIds.has(songRow.id)) continue;

    const currentIll = illustrations.find(
      (i) => i.songId === songRow.id && i.isCurrent,
    );

    const song = new SongData({
      id: songRow.id,
      title: songRow.title || "Unknown",
      artist: songRow.artist || "Unknown",
      key: songRow.key || undefined,
      createdAt: songRow.createdAt,
      updatedAt: songRow.updatedAt,
      startMelody: songRow.startMelody || undefined,
      language: songRow.language || "other",
      tempo: songRow.tempo ? Number(songRow.tempo) : undefined,
      capo: songRow.capo || 0,
      range: songRow.range || undefined,
      chordpro: songRow.chordpro || "",
      externalSource: null,
      currentIllustration: currentIll
        ? {
            illustrationId: currentIll.id,
            promptId: currentIll.promptId,
            imageModel: currentIll.imageModel,
            imageURL: currentIll.imageURL,
            thumbnailURL: currentIll.thumbnailURL,
            promptURL: "",
          }
        : undefined,
      isFavoriteByCurrentUser: false,
    });

    fs.mkdirSync(proDir, { recursive: true });
    fs.writeFileSync(
      path.join(proDir, `${song.id}.pro`),
      formatChordpro(song.toCustomChordpro()),
    );

    const songPrompts = prompts.filter((p) => p.songId === song.id);
    const songIllustrations = illustrations.filter(
      (i) => i.songId === song.id,
    );

    const yamlDir = path.join(illustrationsBaseDir, song.id);
    fs.mkdirSync(yamlDir, { recursive: true });

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, YamlIllustration[]>();
      const expectedPromptFolders = new Set<string>(); // Used to clean up orphaned prompts later

      for (const ill of songIllustrations) {
        if (ill.deleted) continue;

        const rawPromptPart = ill.promptId
          ? ill.promptId.replace(song.id + "_", "")
          : "unknown";
        const promptPathPart = sanitizePathSegment(rawPromptPart);
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const filename = `${safeModelName}.webp`;

        // Track that this folder should exist on disk
        expectedPromptFolders.add(promptPathPart);

        if (!illustrationsByPrompt.has(ill.promptId)) {
          illustrationsByPrompt.set(ill.promptId, []);
        }

        const createdAtDate =
          ill.createdAt instanceof Date
            ? ill.createdAt
            : new Date(ill.createdAt);
        const safeCreatedAt = isNaN(createdAtDate.getTime())
          ? Date.now()
          : createdAtDate.getTime();

        illustrationsByPrompt.get(ill.promptId)!.push({
          createdAt: safeCreatedAt,
          imageModel: ill.imageModel,
          filename,
        });
      }

      // Invalid dates would serialize as garbage in the yaml, so null them out.
      const sanitizeDate = (value: Date | string | null) => {
        const date = value instanceof Date ? value : new Date(value ?? NaN);
        return isNaN(date.getTime()) ? null : date;
      };

      const safePrompts = songPrompts
        .filter((p) => !p.deleted)
        .map((p) => ({
          ...p,
          createdAt: sanitizeDate(p.createdAt),
          updatedAt: sanitizeDate(p.updatedAt),
          illustrations: illustrationsByPrompt.get(p.id) || [],
        }));

      const metadata = {
        songId: song.id,
        prompts: safePrompts,
      };

      fs.writeFileSync(
        path.join(yamlDir, "illustrations.yaml"),
        yaml.dump(metadata),
      );

      // Download missing images
      for (const ill of songIllustrations) {
        if (ill.deleted || !ill.imageURL) continue;

        const promptPathPart = sanitizePathSegment(
          ill.promptId.replace(song.id + "_", ""),
        );
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const imgDir = path.join(yamlDir, promptPathPart, "full");
        fs.mkdirSync(imgDir, { recursive: true });

        const imgPath = path.join(imgDir, `${safeModelName}.webp`);

        if (!fs.existsSync(imgPath)) {
          if (ill.imageURL.startsWith("http")) {
            try {
              const response = await fetch(ill.imageURL);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              const arrayBuffer = await response.arrayBuffer();
              fs.writeFileSync(imgPath, Buffer.from(arrayBuffer));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.error(
                `Failed to fetch image ${ill.imageURL}:`,
                message,
              );
            }
          }
        }
      }

      // ---  CLEANUP ORPHANED PROMPTS WITHIN THE SONG ---
      // If an illustration was deleted, its specific prompt folder might still exist. Let's sweep it.
      for (const item of fs.readdirSync(yamlDir)) {
        const itemPath = path.join(yamlDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          if (
            !expectedPromptFolders.has(item) &&
            !referencedPromptDirs.has(`${song.id}/${item}`)
          ) {
            fs.rmSync(itemPath, { recursive: true, force: true });
          }
        }
      }
    } else {
      // If there are no prompts or illustrations at all, just write an empty yaml
      fs.writeFileSync(
        path.join(yamlDir, "illustrations.yaml"),
        yaml.dump({ songId: song.id, prompts: [] }),
      );
    }
  }
  console.log("✓ GitHub Sync file generation completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
