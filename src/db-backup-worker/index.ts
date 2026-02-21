/// <reference types="../../worker-configuration.d.ts" />
import { drizzle } from "drizzle-orm/d1";
import { eq, gte } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { SongData } from "../web/types/songData";
import { Octokit } from "octokit";
import { Buffer } from "node:buffer";
import yaml from "js-yaml";
import { sanitizePathSegment, getR2Key } from "./sync-utils";
import { moveToTrashR2 } from "src/worker/helpers/illustration-helpers";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  KV: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_OWNER: string;
  SYNC_SECRET: string;
}

interface BackupData {
  metadata: {
    version: string;
    database: string;
    createdAt: string;
    tables: string[];
  };
  tables: Record<string, any[]>;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    try {
      console.log("Starting scheduled tasks...");
      await backupDbToR2(env);
      await syncToGithub(env, false);
      console.log("✓ All scheduled tasks completed successfully.");
    } catch (error) {
      console.error("Scheduled task failed:", error);
      throw error;
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      // Basic security check to prevent unauthorized spam
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${env.SYNC_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      console.log("Manual trigger for scheduled tasks initiated...");
      const url = new URL(request.url);
      const isFullSync = url.searchParams.get("full") === "true";

      await syncToGithub(env, isFullSync);
      await backupDbToR2(env);

      return new Response(
        `Backup and GitHub Sync (Full: ${isFullSync}) completed successfully`,
        {
          status: 200,
        },
      );
    } catch (error: any) {
      console.error("Fetch handler caught an error:", error);
      return new Response(`Task failed: ${error.message}\n${error.stack}`, {
        status: 500,
      });
    }
  },
};

// ---------------------------------------------------------------------------
// TASK 1: Backup D1 Database to R2 JSON
// ---------------------------------------------------------------------------
async function backupDbToR2(env: Env): Promise<void> {
  console.log("Starting D1 to R2 backup...");
  const db = drizzle(env.DB, { schema });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupKey = `backups/db-backup-${timestamp}.json`;
  const songDBVersion = (await env.KV.get("songDB-version")) ?? "v0";

  const backupData: BackupData = {
    metadata: {
      version: songDBVersion,
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

  for (const [tableName, table] of tables) {
    try {
      const rows = await db
        .select()
        .from(table as any)
        .all();
      backupData.tables[tableName] = rows;
      backupData.metadata.tables.push(tableName);
    } catch (error) {
      console.error(`  ✗ Failed to backup ${tableName}:`, error);
    }
  }

  await env.R2_BUCKET.put(backupKey, JSON.stringify(backupData, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      backupDate: new Date().toISOString(),
      type: "automated-backup",
    },
  });

  console.log(`✓ DB Backup completed: ${backupKey}`);
  await cleanupOldBackups(env.R2_BUCKET, 30);
}

async function cleanupOldBackups(
  bucket: R2Bucket,
  keepDays: number,
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);

  const list = await bucket.list({ prefix: "backups/" });
  let deletedCount = 0;

  for (const object of list.objects) {
    const match = object.key.match(
      /db-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/,
    );
    if (match) {
      const backupDate = new Date(
        match[1].replace(/-/g, ":").replace("T", "T").slice(0, -3),
      );
      if (backupDate < cutoffDate) {
        // Apply shadow deletion to old backups
        await moveToTrashR2(bucket, object.key);
        deletedCount++;
      }
    }
  }
  if (deletedCount > 0)
    console.log(`✓ Shadow deleted ${deletedCount} old backup(s) to /trash`);
}

// ---------------------------------------------------------------------------
// TASK 2: Sync ChordPro & Assets to GitHub PR
// ---------------------------------------------------------------------------
async function syncToGithub(env: Env, isFullSync: boolean): Promise<void> {
  console.log(`Starting GitHub Sync process... (Full Sync: ${isFullSync})`);
  const db = drizzle(env.DB, { schema });

  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
  const [owner, repo] = env.GITHUB_REPO.split("/");
  if (!owner || !repo)
    throw new Error("GITHUB_REPO env var must be in format 'owner/repo'");

  const syncWindow = new Date();
  syncWindow.setDate(syncWindow.getDate() - 7);

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

  if (!isFullSync) {
    songsQuery.where(gte(schema.song.updatedAt, syncWindow));
    promptsQuery.where(gte(schema.illustrationPrompt.updatedAt, syncWindow));
    illustrationsQuery.where(
      gte(schema.songIllustration.updatedAt, syncWindow),
    );
  }

  const [allSongs, allPrompts, allIllustrations] = await Promise.all([
    songsQuery.all(),
    promptsQuery.all(),
    illustrationsQuery.all(),
  ]);

  console.log(
    `Fetched for sync: ${allSongs.length} songs, ${allPrompts.length} prompts, ${allIllustrations.length} illustrations.`,
  );

  const treeEntries: {
    path: string;
    mode: "100644" | "100755" | "040000" | "160000" | "120000";
    type: "blob" | "tree" | "commit";
    sha?: string | null;
    content?: string;
  }[] = [];

  const blobUploadPromises: Promise<{
    path: string;
    sha: string;
    r2Key: string;
  } | null>[] = [];

  for (const songRow of allSongs) {
    if (songRow.sourceId) {
      continue;
    }
    if (songRow.deleted) {
      treeEntries.push({
        path: `songs/chordpro/${songRow.id}.pro`,
        mode: "100644",
        type: "blob",
        sha: null,
      });
      treeEntries.push({
        path: `songs/illustrations/${songRow.id}/illustrations.yaml`,
        mode: "100644",
        type: "blob",
        sha: null,
      });

      continue;
    }
    const currentIll = allIllustrations.find(
      (i) => i.id === songRow.currentIllustrationId,
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
      capo: songRow.capo || undefined,
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
    });
    treeEntries.push({
      path: `songs/chordpro/${song.id}.pro`,
      mode: "100644",
      type: "blob",
      content: song.toCustomChordpro(),
    });

    const songPrompts = allPrompts.filter((p) => p.songId === song.id);
    const songIllustrations = allIllustrations.filter(
      (i) => i.songId === song.id,
    );

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, any[]>();

      for (const ill of songIllustrations) {
        if (ill.deleted) {
          continue;
        }

        const rawPromptPart = ill.promptId
          ? ill.promptId.replace(song.id + "_", "")
          : "unknown";
        const promptPathPart = sanitizePathSegment(rawPromptPart);
        const safeModelName = sanitizePathSegment(ill.imageModel || "unknown");
        const filename = `${safeModelName}.webp`;

        if (!illustrationsByPrompt.has(ill.promptId))
          illustrationsByPrompt.set(ill.promptId, []);
        illustrationsByPrompt.get(ill.promptId)!.push({
          createdAt: ill.createdAt.getTime(),
          imageModel: ill.imageModel,
          filename,
        });

        const url = ill.imageURL;
        if (url) {
          blobUploadPromises.push(
            (async () => {
              const r2Key = getR2Key(url);
              const r2Object = await env.R2_BUCKET.get(r2Key);
              if (!r2Object) return null;

              const arrayBuf = await r2Object.arrayBuffer();
              const buf = Buffer.from(arrayBuf);

              const { data: blobData } = await octokit.rest.git.createBlob({
                owner,
                repo,
                content: buf.toString("base64"),
                encoding: "base64",
              });

              return {
                path: `songs/illustrations/${song.id}/${promptPathPart}/full/${filename}`,
                sha: blobData.sha,
                r2Key,
              };
            })(),
          );
        }
      }

      const metadata = {
        songId: song.id,
        prompts: songPrompts
          .filter((p) => !p.deleted)
          .map((p) => ({
            ...p,
            illustrations: illustrationsByPrompt.get(p.id) || [],
          })),
      };

      treeEntries.push({
        path: `songs/illustrations/${song.id}/illustrations.yaml`,
        mode: "100644",
        type: "blob",
        content: yaml.dump(metadata),
      });
    }
  }

  const uploadedBlobs = await Promise.all(blobUploadPromises);
  const keysToTrash: string[] = [];

  for (const blob of uploadedBlobs) {
    if (blob) {
      treeEntries.push({
        path: blob.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
      keysToTrash.push(blob.r2Key);
    }
  }

  if (treeEntries.length === 0) {
    console.log("No new changes to sync.");
    return;
  }

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const latestCommitSha = refData.object.sha;

  const { data: treeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: latestCommitSha,
    tree: treeEntries,
  });

  const { data: commitData } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `chore: Automated sync of database changes (${isFullSync ? "Full" : "Incremental"})`,
    tree: treeData.sha,
    parents: [latestCommitSha],
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const branchName = `data-sync-${timestamp}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: commitData.sha,
  });

  const { data: prData } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Automated Data Sync: ${timestamp}`,
    head: branchName,
    base: defaultBranch,
    body: `Automated pull request pushing the newest database changes.\n\nFiles synced: \`${treeEntries.length}\``,
  });

  console.log(`✓ Pull Request created: ${prData.html_url}`);

  // TODO: Enable shadow deletions once the sync pipeline is fully tested
  /*
  if (keysToTrash.length > 0) {
    const shadowDeletePromises = keysToTrash.map(key => moveToTrashR2(env.R2_BUCKET, key));
    await Promise.all(shadowDeletePromises);
    console.log(`✓ Shadow deleted ${keysToTrash.length} synced files to /trash in R2.`);
  }
  */
  if (keysToTrash.length > 0) {
    console.log(
      `ℹ Skipped shadow deletion of ${keysToTrash.length} synced files in R2 (Pending implementation).`,
    );
  }
}
