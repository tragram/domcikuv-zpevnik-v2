import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../src/lib/db/schema";
import { SongData } from "../src/web/types/songData";
import { formatChordpro } from "../src/web/lib/formatChordpro";

export function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 1. Setup R2 (S3 Client) - Used ONLY for the database backup JSON
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
});

// 2. Setup Drizzle over HTTP via SQLite Proxy
const db = drizzle(
  async (sql, params, method) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID!.trim()}/d1/database/${process.env.CF_DATABASE_ID!.trim()}/query`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(
        `D1 Query Failed: ${response.status} - ${await response.text()}`,
      );
    }

    const data = await response.json();
    const results = data.result[0].results;

    const rows = results.map((row: any) => Object.values(row));
    return { rows };
  },
  { schema },
);

async function main() {
  console.log(`Starting Sync...`);

  // ---------------------------------------------------------------------------
  // TASK 1: Backup D1 Database to R2 JSON
  // ---------------------------------------------------------------------------
  console.log("Starting D1 to R2 backup...");

  const backupData: any = {
    metadata: {
      version: "v0",
      database: "zpevnik",
      createdAt: new Date().toISOString(),
      tables: [],
    },
    tables: {},
  };
  const EXCLUDED_TABLES = ["account", "session", "user"];

  const tables = Object.entries(schema).filter(([key, value]) => {
    return (
      value &&
      typeof value === "object" &&
      Symbol.for("drizzle:IsDrizzleTable") in value &&
      !EXCLUDED_TABLES.includes(key) // Skip the excluded tables
    );
  });

  for (const [tableName, table] of tables) {
    const rows = await db.select().from(table as any);
    backupData.tables[tableName] = rows;
    backupData.metadata.tables.push(tableName);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
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
      currentIllustrationId: schema.song.currentIllustrationId,
      sourceId: schema.songImport.sourceId,
    })
    .from(schema.song)
    .leftJoin(
      schema.songVersion,
      eq(schema.song.currentVersionId, schema.songVersion.id),
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
      if (!activeSongIds.has(folder)) {
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
      (i: any) => i.id === songRow.currentIllustrationId,
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
    } as any);

    fs.mkdirSync(proDir, { recursive: true });
    fs.writeFileSync(
      path.join(proDir, `${song.id}.pro`),
      formatChordpro(song.toCustomChordpro()),
    );

    const songPrompts = prompts.filter((p: any) => p.songId === song.id);
    const songIllustrations = illustrations.filter(
      (i: any) => i.songId === song.id,
    );

    const yamlDir = path.join(illustrationsBaseDir, song.id);
    fs.mkdirSync(yamlDir, { recursive: true });

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, any[]>();
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

      const safePrompts = songPrompts
        .filter((p: any) => !p.deleted)
        .map((p: any) => {
          const cleanP = { ...p };
          for (const key of Object.keys(cleanP)) {
            if (key === "createdAt" || key === "updatedAt") {
              const d = new Date(cleanP[key]);
              cleanP[key] = isNaN(d.getTime()) ? null : d;
            } else if (cleanP[key] instanceof Date) {
              cleanP[key] = isNaN(cleanP[key].getTime()) ? null : cleanP[key];
            }
          }
          return {
            ...cleanP,
            illustrations: illustrationsByPrompt.get(p.id) || [],
          };
        });

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
            } catch (error: any) {
              console.error(
                `Failed to fetch image ${ill.imageURL}:`,
                error.message,
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
          if (!expectedPromptFolders.has(item)) {
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
