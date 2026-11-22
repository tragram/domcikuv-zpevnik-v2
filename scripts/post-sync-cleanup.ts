/** Promote verified static illustrations and archive originals after 30 days. */
import {
  CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand,
  HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, type _Object,
} from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { canonicalIllustrationPath } from "./shared/illustration-paths";
import {
  archiveOriginal, promoteIllustration, referencesBucketSource, sha256, sourceKey,
  type ArchiveRecord, type CleanupResult, type CleanupStore,
} from "./shared/illustration-cleanup";
import { db } from "./shared/remote-db";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";

const PROD_BASE_URL = (process.env.PROD_BASE_URL || "https://zpevnik.hodan.page").replace(/\/+$/, "");
const BUCKET_URL = (process.env.CLOUDFLARE_R2_URL || "https://kyblik.zpevnik.hodan.page").replace(/\/+$/, "");
const RECORD_PREFIX = "cleanup/illustration-promotions/";
const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!["--dry-run", "--prune-backups"].includes(flag)) throw new Error(`Unknown flag: ${flag}`);
}
const dryRun = flags.has("--dry-run") || process.env.CLEANUP_DRY_RUN === "true";
const pruneBackups = flags.has("--prune-backups");
const recordKey = (record: ArchiveRecord) => `${RECORD_PREFIX}${sha256(Buffer.from(record.illustrationId))}.json`;
const archiveRecordSchema = z.object({
  version: z.literal(1),
  illustrationId: z.string().min(1),
  sourceKey: z.string().regex(/^songs\/illustrations\/[^/]+\/[^/]+\/full\/[^/]+$/),
  imageURL: z.string(),
  thumbnailURL: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  staticSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  promotedAt: z.iso.datetime(),
}).superRefine((record, ctx) => {
  const imageURL = canonicalIllustrationPath(`/${record.sourceKey}${record.sourceKey.endsWith(".webp") ? "" : ".webp"}`);
  if (
    canonicalIllustrationPath(record.imageURL) !== imageURL ||
    canonicalIllustrationPath(record.thumbnailURL) !== imageURL.replace(/\/full\/([^/]+)$/, "/thumbnail/$1")
  ) {
    ctx.addIssue({ code: "custom", message: "Archive paths do not match the source key" });
  }
});

function notFound(error: unknown): boolean {
  return !!error && typeof error === "object" && (
    ("name" in error && ["NoSuchKey", "NotFound"].includes(String(error.name))) ||
    ("$metadata" in error && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404)
  );
}

async function readObject(key: string) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }), {
      abortSignal: AbortSignal.timeout(30_000),
    });
    if (!object.Body || !object.ETag) throw new Error(`R2 object missing body or ETag: ${key}`);
    return { bytes: await object.Body.transformToByteArray(), etag: object.ETag };
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

const store: CleanupStore = {
  readImage: readObject,
  async saveRecord(record) {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: recordKey(record),
      Body: JSON.stringify(record), ContentType: "application/json",
    }));
  },
  async promote(illustration, record) {
    const updated = await db.update(schema.songIllustration).set({
      imageURL: record.imageURL, thumbnailURL: record.thumbnailURL, updatedAt: new Date(),
    }).where(and(
      eq(schema.songIllustration.id, illustration.id),
      eq(schema.songIllustration.imageURL, illustration.imageURL),
      eq(schema.songIllustration.thumbnailURL, illustration.thumbnailURL),
      eq(schema.songIllustration.updatedAt, illustration.updatedAt),
      eq(schema.songIllustration.deleted, false),
    )).returning({ id: schema.songIllustration.id });
    return updated.length === 1;
  },
  async readIllustration(id) {
    const rows = await db.select().from(schema.songIllustration).where(eq(schema.songIllustration.id, id));
    return rows[0];
  },
  async referencesSource(key) {
    // Include deleted rows: a later restore must not resurrect a broken URL.
    const rows = await db.select({
      imageURL: schema.songIllustration.imageURL,
      thumbnailURL: schema.songIllustration.thumbnailURL,
    }).from(schema.songIllustration);
    return rows.some(row => [row.imageURL, row.thumbnailURL].some(url => referencesBucketSource(url, key, BUCKET_URL)));
  },
  async copyToTrash(key, etag) {
    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: `trash/${key}`,
      CopySource: `${R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`,
      CopySourceIfMatch: etag,
    }));
  },
  async sourceEtag(key) {
    try {
      return (await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))).ETag;
    } catch (error) {
      if (notFound(error)) return;
      throw error;
    }
  },
  async deleteSource(key) {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
  },
  async deleteRecord(record) {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: recordKey(record) }));
  },
};

async function listObjects(prefix: string): Promise<_Object[]> {
  const objects: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: token,
    }));
    objects.push(...page.Contents ?? []);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !token) throw new Error(`Missing pagination token for ${prefix}`);
  } while (token);
  return objects;
}

async function cleanupBackups() {
  const files = await listObjects("backups/db-backup-");
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const months = new Set<string>();
  const toDelete: { Key: string }[] = [];
  // Keep the newest backup of each older month.
  files.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));
  for (const file of files) {
    if (!file.Key || !file.LastModified || file.LastModified >= cutoff) continue;
    const month = file.LastModified.toISOString().slice(0, 7);
    if (!months.has(month)) months.add(month);
    else toDelete.push({ Key: file.Key });
  }
  console.log(`${dryRun ? "Would prune" : "Pruning"} ${toDelete.length} old backups.`);
  if (dryRun) return;
  for (let offset = 0; offset < toDelete.length; offset += 1000) {
    const result = await s3.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME, Delete: { Objects: toDelete.slice(offset, offset + 1000) },
    }));
    if (result.Errors?.length) throw new Error(`Backup deletion failed: ${JSON.stringify(result.Errors)}`);
  }
}

async function main() {
  console.log(`${dryRun ? "DRY RUN: " : ""}Verifying illustrations against ${PROD_BASE_URL}`);
  const counts: Partial<Record<CleanupResult | "failed", number>> = {};
  async function run(id: string, action: () => Promise<CleanupResult>) {
    try {
      const result = await action();
      counts[result] = (counts[result] ?? 0) + 1;
      console.log(`[${result}] ${id}`);
    } catch (error) {
      counts.failed = (counts.failed ?? 0) + 1;
      console.error(`[failed] ${id}:`, error instanceof Error ? error.message : error);
    }
  }
  const illustrations = await db.select().from(schema.songIllustration);
  for (const illustration of illustrations) {
    if (illustration.deleted || !sourceKey(illustration.imageURL, BUCKET_URL)) continue;
    await run(illustration.id, () => promoteIllustration(illustration, store, {
      productionURL: PROD_BASE_URL, bucketURL: BUCKET_URL, dryRun, now: new Date(),
    }));
  }
  // Every run reconciles archival; the persisted promotion date enforces retention.
  for (const object of await listObjects(RECORD_PREFIX)) {
    if (!object.Key) continue;
    await run(object.Key, async () => {
      const stored = await readObject(object.Key!);
      if (!stored) throw new Error("Archive record disappeared");
      const record = archiveRecordSchema.parse(JSON.parse(Buffer.from(stored.bytes).toString("utf8")));
      if (recordKey(record) !== object.Key) throw new Error("Archive record key mismatch");
      return archiveOriginal(record, store, { productionURL: PROD_BASE_URL, dryRun, now: new Date() });
    });
  }
  if (pruneBackups) {
    try { await cleanupBackups(); }
    catch (error) {
      counts.failed = (counts.failed ?? 0) + 1;
      console.error("[failed] Backup cleanup:", error);
    }
  }
  console.log("Cleanup summary:", JSON.stringify(counts));
  // Awaiting deployment is expected; mismatched content and operational errors need attention.
  if (counts.failed || counts["content-mismatch"]) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
