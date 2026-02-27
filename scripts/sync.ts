// used by github actions

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { SongData } from "../src/web/types/songData";
import * as schema from "../src/lib/db/schema";
export function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const isFullSync = process.env.IS_FULL_SYNC === "true";

// 1. Setup R2 (S3 Client) - Requires S3 Access Keys, not the Cloudflare API Token
const s3 = new S3Client({
  region: "auto",
  // Added .trim() to Account ID
  endpoint: `https://${process.env.CF_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    // Added .trim() to both keys
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
});

// 2. Setup Drizzle over HTTP via SQLite Proxy
const db = drizzle(
  async (sql, params, method) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_DATABASE_ID}/query`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        // Added .trim() to the API token
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
    const rows = data.result[0].results;

    return { rows };
  },
  { schema },
);

async function main() {
  console.log(`Starting Worker-less Sync... Full Sync: ${isFullSync}`);

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

  const tables = Object.entries(schema).filter(([key, value]) => {
    return (
      value &&
      typeof value === "object" &&
      Symbol.for("drizzle:IsDrizzleTable") in value
    );
  });

  // Use Drizzle to fetch all rows for backups
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
  // TASK 2: Sync to GitHub (Local File Generation)
  // ---------------------------------------------------------------------------
  console.log("Fetching data for GitHub sync via Drizzle...");

  // Use your exact Drizzle logic from the original Worker
  const songsQuery = db.select().from(schema.song);
  const promptsQuery = db.select().from(schema.illustrationPrompt);
  const illustrationsQuery = db.select().from(schema.songIllustration);

  if (!isFullSync) {
    const syncWindow = new Date();
    syncWindow.setDate(syncWindow.getDate() - 7);

    songsQuery.where(gte(schema.song.updatedAt, syncWindow));
    promptsQuery.where(gte(schema.illustrationPrompt.updatedAt, syncWindow));
    illustrationsQuery.where(
      gte(schema.songIllustration.updatedAt, syncWindow),
    );
  }

  const [songs, prompts, illustrations] = await Promise.all([
    songsQuery,
    promptsQuery,
    illustrationsQuery,
  ]);

  console.log(`Fetched: ${songs.length} songs, ${prompts.length} prompts.`);

  // Write files to disk exactly as we mapped out previously
  for (const songRow of songs) {
    if (songRow.deleted) {
      const proPath = path.join(
        process.cwd(),
        `songs/chordpro/${songRow.id}.pro`,
      );
      const yamlPath = path.join(
        process.cwd(),
        `songs/illustrations/${songRow.id}/illustrations.yaml`,
      );
      if (fs.existsSync(proPath)) fs.unlinkSync(proPath);
      if (fs.existsSync(yamlPath)) fs.unlinkSync(yamlPath);
      continue;
    }

    const song = new SongData({ ...songRow });
    const proDir = path.join(process.cwd(), "songs/chordpro");
    fs.mkdirSync(proDir, { recursive: true });
    fs.writeFileSync(
      path.join(proDir, `${song.id}.pro`),
      song.toCustomChordpro(),
    );

    const songPrompts = prompts.filter((p: any) => p.songId === song.id);
    const songIllustrations = illustrations.filter(
      (i: any) => i.songId === song.id,
    );

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, any[]>();

      // Recreate your original illustration mapping logic
      for (const ill of songIllustrations) {
        if (ill.deleted) continue;

        const rawPromptPart = ill.promptId
          ? ill.promptId.replace(song.id + "_", "")
          : "unknown";
        const promptPathPart = sanitizePathSegment(rawPromptPart);
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const filename = `${safeModelName}.webp`;

        if (!illustrationsByPrompt.has(ill.promptId)) {
          illustrationsByPrompt.set(ill.promptId, []);
        }

        // Safely extract the timestamp, falling back to Date.now() if it's an Invalid Date
        const createdAtDate = new Date(ill.createdAt);
        const safeCreatedAt = isNaN(createdAtDate.getTime())
          ? Date.now()
          : createdAtDate.getTime();

        illustrationsByPrompt.get(ill.promptId)!.push({
          createdAt: safeCreatedAt,
          imageModel: ill.imageModel,
          filename,
        });
      }

      // Sanitize the prompts to ensure js-yaml doesn't choke on Invalid Dates
      const safePrompts = songPrompts
        .filter((p: any) => !p.deleted)
        .map((p: any) => {
          const cleanP = { ...p };
          // Convert any valid Dates to ISO strings, and Invalid Dates to null
          for (const key of Object.keys(cleanP)) {
            if (cleanP[key] instanceof Date) {
              cleanP[key] = isNaN(cleanP[key].getTime())
                ? null
                : cleanP[key].toISOString();
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

      const yamlDir = path.join(
        process.cwd(),
        `songs/illustrations/${song.id}`,
      );
      fs.mkdirSync(yamlDir, { recursive: true });
      fs.writeFileSync(
        path.join(yamlDir, "illustrations.yaml"),
        yaml.dump(metadata),
      );

      // Download Images
      for (const ill of songIllustrations) {
        if (ill.deleted || !ill.imageURL) continue;

        const promptPathPart = sanitizePathSegment(
          ill.promptId.replace(song.id + "_", ""),
        );
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const imgDir = path.join(yamlDir, promptPathPart, "full");
        fs.mkdirSync(imgDir, { recursive: true });

        const imgPath = path.join(imgDir, `${safeModelName}.webp`);

        if (!fs.existsSync(imgPath) || isFullSync) {
          const r2Key = new URL(ill.imageURL).pathname.slice(1);
          const { Body } = await s3.send(
            new GetObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: r2Key,
            }),
          );
          if (Body) {
            const buffer = Buffer.from(await Body.transformToByteArray());
            fs.writeFileSync(imgPath, buffer);
          }
        }
      }
    }
  }
  console.log("✓ GitHub Sync file generation completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
