/// <reference types="../../worker-configuration.d.ts" />
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../lib/db/schema";
import { SongData } from "../web/types/songData";
import { Octokit } from "octokit";
import { Buffer } from "node:buffer";
import yaml from "js-yaml";
import { retrieveSongs } from "../worker/helpers/song-helpers";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  KV: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_OWNER: string;
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
      await syncToGithub(env);
      console.log("✓ All scheduled tasks completed successfully.");
    } catch (error) {
      console.error("Scheduled task failed:", error);
      throw error;
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      console.log("Manual trigger for scheduled tasks initiated...");
      await syncToGithub(env);
      await backupDbToR2(env);
      return new Response("Backup and GitHub Sync completed successfully", {
        status: 200,
      });
    } catch (error: any) {
      console.error("Fetch handler caught an error:", error);
      return new Response(`Task failed: ${error.message}\n${error.stack}`, {
        status: 500,
      });
    }
  },
};

// --- GUARDS & HELPERS ---

/**
 * Ensures a string is safe to use as a folder or file name in Git.
 * Strips URLs, slashes, and special characters.
 */
function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-") // Replace bad chars with dashes
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, ""); // Trim dashes from start/end
}

/**
 * Extracts the correct R2 key, even if wrapped in a Cloudflare image resizing URL.
 */
function getR2Key(url: string): string {
  let key = url;

  // Strip Cloudflare CDN Image Resizing prefix if it exists
  const cgiMatch = key.match(/^\/?cdn-cgi\/image\/[^/]+\/(.+)$/);
  if (cgiMatch) {
    key = cgiMatch[1];
  }

  try {
    return new URL(key).pathname.replace(/^\//, "");
  } catch {
    return key.replace(/^\//, "");
  }
}

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
        await bucket.delete(object.key);
        deletedCount++;
      }
    }
  }
  if (deletedCount > 0)
    console.log(`✓ Cleaned up ${deletedCount} old backup(s)`);
}

// ---------------------------------------------------------------------------
// TASK 2: Sync ChordPro & Assets to GitHub PR (Using Octokit)
// ---------------------------------------------------------------------------
async function syncToGithub(env: Env): Promise<void> {
  console.log("Starting GitHub Sync process...");
  const db = drizzle(env.DB, { schema });

  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
  const [owner, repo] = env.GITHUB_REPO.split("/");
  if (!owner || !repo)
    throw new Error("GITHUB_REPO env var must be in format 'owner/repo'");

  const allSongsApi = await retrieveSongs(
    db,
    undefined,
    undefined,
    false,
    false,
  );
  const allPrompts = await db.select().from(schema.illustrationPrompt).all();
  const allIllustrations = await db
    .select()
    .from(schema.songIllustration)
    .all();

  console.log(
    `Syncing ${allSongsApi.length} songs, ${allPrompts.length} prompts, ${allIllustrations.length} illustrations.`,
  );

  const treeEntries: {
    path: string;
    mode: "100644" | "100755" | "040000" | "160000" | "120000";
    type: "blob" | "tree" | "commit";
    sha?: string;
    content?: string;
  }[] = [];

  for (const songApi of allSongsApi) {
    const song = new SongData(songApi);

    // A. ChordPro
    treeEntries.push({
      path: `songs/chordpro/${song.id}.pro`,
      mode: "100644",
      type: "blob",
      content: song.toCustomChordpro(),
    });

    // B. Images & YAML
    const songPrompts = allPrompts.filter((p) => p.songId === song.id);
    const songIllustrations = allIllustrations.filter(
      (i) => i.songId === song.id,
    );

    if (songPrompts.length > 0 || songIllustrations.length > 0) {
      const illustrationsByPrompt = new Map<string, any[]>();

      for (const ill of songIllustrations) {
        // Sanitize the paths to guard against full URLs in the database
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
          const r2Key = getR2Key(url);
          const r2Object = await env.R2_BUCKET.get(r2Key);

          if (r2Object) {
            const buf = Buffer.from(await r2Object.arrayBuffer());

            const { data: blobData } = await octokit.rest.git.createBlob({
              owner,
              repo,
              content: buf.toString("base64"),
              encoding: "base64",
            });

            treeEntries.push({
              path: `songs/illustrations/${song.id}/${promptPathPart}/full/${filename}`,
              mode: "100644",
              type: "blob",
              sha: blobData.sha,
            });
          }
        }
      }

      // YAML Metadata
      const metadata = {
        songId: song.id,
        prompts: songPrompts.map((p) => ({
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

  if (treeEntries.length === 0) return;

  // 3. Git Operations (Commit & PR)
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const latestCommitSha = refData.object.sha;

  // Create Tree
  const { data: treeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: latestCommitSha,
    tree: treeEntries,
  });

  // Create Commit
  const { data: commitData } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: "chore: Automated sync of ChordPro data and illustrations",
    tree: treeData.sha,
    parents: [latestCommitSha],
  });

  // Create Branch
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const branchName = `data-sync-${timestamp}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: commitData.sha,
  });

  // Create Pull Request
  const { data: prData } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Automated Data Sync: ${timestamp}`,
    head: branchName,
    base: defaultBranch,
    body: `Automated pull request pushing the newest ChordPro configurations, generated prompts, and illustrations.\n\nFiles synced: \`${treeEntries.length}\``,
  });

  console.log(`✓ Pull Request created: ${prData.html_url}`);
}
