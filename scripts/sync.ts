import { PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { canonicalIllustrationPath, staticIllustrationPath } from "./shared/illustration-paths";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../src/lib/db/schema";
import { promptFolder, sanitizePathSegment } from "../src/lib/song-ids";
import { db } from "./shared/remote-db";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";
import { renderSnapshotSheet } from "./sync/render-song";
import { syncIllustrationFile } from "./shared/illustration-files";
import { assignSnapshotVersions, eligibleSnapshotVersion, reservedVersionsSchema, segment, songManifestSchema } from "./shared/song-snapshot";

type DBBackup = {
  metadata: {
    version: string;
    database: string;
    createdAt: string;
    tables: string[];
  };
  tables: Record<string, unknown[]>;
};

// Per-illustration entry written into song.yaml.
type YamlIllustration = {
  createdAt: number;
  imageModel: string;
  filename: string;
};

async function main() {
  console.log(`Starting Sync...`);
  let imageFailures = 0;

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
      currentVersionId: schema.song.currentVersionId,
      currentIllustrationId: schema.song.currentIllustrationId,
      version: schema.songVersion,
    })
    .from(schema.song)
    .innerJoin(schema.songVersion, and(
      eq(schema.song.id, schema.songVersion.songId),
      eq(schema.songVersion.status, "published"),
    ))
    .where(eq(schema.song.deleted, false))
    .orderBy(schema.song.id, schema.songVersion.createdAt, schema.songVersion.id);

  const promptsQuery = db.select().from(schema.illustrationPrompt);
  const illustrationsQuery = db.select().from(schema.songIllustration);

  const [rows, prompts, illustrations] = await Promise.all([
    songsQuery,
    promptsQuery,
    illustrationsQuery,
  ]);

  const songs = new Map<string, {
    currentVersionId: string | null;
    currentIllustrationId: string | null;
    versions: schema.SongVersionDB[];
  }>();
  for (const { version, ...selection } of rows) {
    segment.parse(version.songId);
    if (!eligibleSnapshotVersion(version)) continue;
    const group = songs.get(version.songId) ?? { ...selection, versions: [] };
    group.versions.push(version);
    songs.set(version.songId, group);
  }
  for (const [id, group] of songs) {
    if (!group.versions.some(version => version.id === group.currentVersionId)) songs.delete(id);
  }
  if (!songs.size) throw new Error("Refusing an empty song export");
  console.log(`Exporting ${songs.size} songs, ${prompts.length} prompts.`);

  // These database values become directory names before snapshot validation.
  for (const ill of illustrations) {
    const folder = sanitizePathSegment(promptFolder(ill.songId, ill.promptId));
    segment.parse(folder);
    segment.parse(sanitizePathSegment(ill.imageModel));
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
      const match = staticIllustrationPath.exec(canonicalIllustrationPath(url));
      if (match) {
        referencedIllustrationDirs.add(match[1]);
        referencedPromptDirs.add(`${match[1]}/${match[2]}`);
      }
    }
  }

  // --- CLEANUP ORPHANED LOCAL FILES ---
  console.log("Sweeping local directories for deleted records...");
  const songsDir = path.join(process.cwd(), "songs");
  const folders = fs.readdirSync(songsDir, { withFileTypes: true })
    .filter(folder => folder.isDirectory() && segment.safeParse(folder.name).success);
  const assignments = new Map<string, Record<string, string>>();
  for (const folder of folders) {
    const manifestPath = path.join(songsDir, folder.name, "song.yaml");
    const reservedPath = path.join(songsDir, folder.name, "version-numbers.yaml");
    if (fs.existsSync(manifestPath)) {
      if (fs.existsSync(reservedPath)) throw new Error(`Conflicting version assignments for ${folder.name}`);
      const manifest = songManifestSchema.parse(yaml.load(fs.readFileSync(manifestPath, "utf8")));
      if (manifest.songId !== folder.name) throw new Error(`Song ID mismatch: ${manifestPath}`);
      assignments.set(folder.name, {
        ...manifest.reserved,
        ...Object.fromEntries(Object.entries(manifest.versions).map(([name, version]) => [name, version.id])),
      });
    } else if (fs.existsSync(reservedPath)) {
      assignments.set(folder.name, reservedVersionsSchema.parse(yaml.load(fs.readFileSync(reservedPath, "utf8"))));
    }
  }
  const numbered = new Map([...songs].map(([id, group]) =>
    [id, assignSnapshotVersions(group.versions, assignments.get(id))]));
  for (const folder of folders) {
    const dir = path.join(songsDir, folder.name);
    const active = numbered.get(folder.name);
    const expected = new Set(Object.keys(active?.versions ?? {}).map(name => `${name}.pro`));
    const previous = assignments.get(folder.name);
    if (!active && previous && fs.existsSync(path.join(dir, "song.yaml"))) {
      fs.writeFileSync(path.join(dir, "version-numbers.yaml"), yaml.dump(previous));
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isFile() && ((entry.name.endsWith(".pro") && !expected.has(entry.name)) ||
          (entry.name === "song.yaml" && !songs.has(folder.name)))) {
        fs.unlinkSync(target);
      }
      if (entry.isDirectory() && segment.safeParse(entry.name).success &&
          !songs.has(folder.name) && !referencedIllustrationDirs.has(folder.name) &&
          ["full", "thumbnail"].some(kind => fs.existsSync(path.join(target, kind)))) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  }

  // --- PHASE C - GENERATE AND UPDATE ACTIVE RECORDS ---
  for (const [songId, { versions, currentVersionId, currentIllustrationId }] of songs) {
    const currentIll = illustrations.find(
      (i) => i.id === currentIllustrationId,
    );
    const yamlDir = path.join(songsDir, songId);
    fs.mkdirSync(yamlDir, { recursive: true });
    const mapping = numbered.get(songId)!;
    const manifest = {
      songId,
      official: Object.keys(mapping.versions).find(name => mapping.versions[name].id === currentVersionId)!,
      ...mapping,
    };
    const versionsById = new Map(versions.map(version => [version.id, version]));
    for (const [name, info] of Object.entries(manifest.versions)) {
      const version = versionsById.get(info.id)!;
      const illustration = version.id === currentVersionId && currentIll
        ? {
            illustrationId: currentIll.id,
            promptId: currentIll.promptId,
            imageModel: currentIll.imageModel,
            imageURL: currentIll.imageURL,
            thumbnailURL: currentIll.thumbnailURL,
            promptURL: "",
          }
        : undefined;
      fs.writeFileSync(path.join(yamlDir, `${name}.pro`),
        renderSnapshotSheet(version, illustration));
    }
    const songPrompts = prompts.filter((p) => p.songId === songId);
    const songIllustrations = illustrations.filter((i) => i.songId === songId);

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, YamlIllustration[]>();
      const expectedPromptFolders = new Set<string>(); // Used to clean up orphaned prompts later

      for (const ill of songIllustrations) {
        if (ill.deleted) continue;

        const rawPromptPart = ill.promptId
          ? promptFolder(songId, ill.promptId)
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
        ...manifest,
        prompts: safePrompts,
      };

      fs.writeFileSync(
        path.join(yamlDir, "song.yaml"),
        yaml.dump(metadata),
      );

      // Bucket keys are mutable: compare bytes even when the file already exists.
      for (const ill of songIllustrations) {
        if (ill.deleted || !ill.imageURL) continue;

        const promptPathPart = sanitizePathSegment(
          promptFolder(songId, ill.promptId),
        );
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const imgDir = path.join(yamlDir, promptPathPart, "full");
        fs.mkdirSync(imgDir, { recursive: true });

        const imgPath = path.join(imgDir, `${safeModelName}.webp`);

        if (ill.imageURL.startsWith("http")) {
          try {
            const result = await syncIllustrationFile(
              ill.imageURL,
              imgPath,
              path.join(yamlDir, promptPathPart, "thumbnail", `${safeModelName}.webp`),
            );
            if (result === "updated") console.log(`Refreshed image: ${imgPath}`);
          } catch (error) {
            imageFailures++;
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to fetch image ${ill.imageURL}:`, message);
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
            !referencedPromptDirs.has(`${songId}/${item}`)
          ) {
            fs.rmSync(itemPath, { recursive: true, force: true });
          }
        }
      }
    } else {
      // If there are no prompts or illustrations at all, just write an empty yaml
      fs.writeFileSync(
        path.join(yamlDir, "song.yaml"),
        yaml.dump({ ...manifest, prompts: [] }),
      );
    }
    fs.rmSync(path.join(yamlDir, "version-numbers.yaml"), { force: true });
  }
  if (imageFailures) throw new Error(`${imageFailures} illustration export(s) failed; refusing to publish an incomplete snapshot.`);
  console.log("✓ GitHub Sync file generation completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
