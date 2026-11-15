import { createHash } from "node:crypto";
import { normalizeWebp } from "../sync/images.mjs";
import sharp from "sharp";

export const ORIGINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type Illustration = {
  id: string;
  imageURL: string;
  thumbnailURL: string;
  updatedAt: Date;
  deleted: boolean;
};

export type ArchiveRecord = {
  version: 1;
  illustrationId: string;
  sourceKey: string;
  imageURL: string;
  thumbnailURL: string;
  sha256: string;
  // sha256 always identifies the untouched R2 source; static bytes may differ.
  staticSha256?: string;
  promotedAt: string;
};

export type StoredImage = { bytes: Uint8Array; etag: string };

export interface CleanupStore {
  readImage(key: string): Promise<StoredImage | null>;
  saveRecord(record: ArchiveRecord): Promise<void>;
  // Must atomically compare the old URLs, timestamp and deletion flag.
  promote(illustration: Illustration, record: ArchiveRecord): Promise<boolean>;
  readIllustration(id: string): Promise<Illustration | undefined>;
  referencesSource(key: string): Promise<boolean>;
  copyToTrash(key: string, etag: string): Promise<void>;
  sourceEtag(key: string): Promise<string | undefined>;
  deleteSource(key: string): Promise<void>;
  deleteRecord(record: ArchiveRecord): Promise<void>;
}

export type CleanupResult =
  | "promoted"
  | "would-promote"
  | "awaiting-deployment"
  | "content-mismatch"
  | "changed"
  | "retained"
  | "archived"
  | "would-archive";

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export function sourceKey(imageURL: string, bucketURL: string): string | undefined {
  if (!URL.canParse(imageURL)) return;
  const url = new URL(imageURL);
  const bucket = new URL(bucketURL);
  if (
    url.origin !== bucket.origin ||
    url.search ||
    url.hash ||
    !/^\/songs\/illustrations\/[^/]+\/[^/]+\/full\/[^/]+$/.test(url.pathname)
  ) return;
  return url.pathname.slice(1);
}

/** Bucket URLs can also be embedded in a /cdn-cgi/image/... thumbnail URL. */
export function referencesBucketSource(url: string, key: string, bucketURL: string): boolean {
  const origin = new URL(bucketURL).origin;
  const offset = url.indexOf(`${origin}/`);
  if (offset === -1) return false;
  const candidate = url.slice(offset);
  return URL.canParse(candidate) && new URL(candidate).pathname === `/${key}`;
}

/** GET verifies real bytes: Workers assets may omit Content-Length on HEAD. */
async function productionImage(baseURL: string, pathname: string, fetcher: typeof fetch) {
  const response = await fetcher(baseURL + pathname, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { "Cache-Control": "no-cache" },
  });
  if (response.status !== 200 && response.status !== 404) {
    await response.body?.cancel();
    throw new Error(`Production returned HTTP ${response.status} for ${pathname}`);
  }
  if (
    response.status !== 200 ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/webp"
  ) {
    await response.body?.cancel();
    return;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.length ? bytes : undefined;
}

export async function verifyProduction(
  record: Pick<ArchiveRecord, "imageURL" | "thumbnailURL" | "sha256" | "staticSha256">,
  baseURL: string,
  fetcher: typeof fetch = fetch,
): Promise<"ready" | "awaiting-deployment" | "content-mismatch"> {
  const image = await productionImage(baseURL, record.imageURL, fetcher);
  if (!image) return "awaiting-deployment";
  if (sha256(image) !== (record.staticSha256 ?? record.sha256)) return "content-mismatch";
  const thumbnail = await productionImage(baseURL, record.thumbnailURL, fetcher);
  if (!thumbnail) return "awaiting-deployment";
  try {
    if ((await sharp(thumbnail).metadata()).format !== "webp") return "content-mismatch";
    await sharp(thumbnail).resize(1, 1).raw().toBuffer();
  } catch { return "content-mismatch"; }
  return "ready";
}

export async function promoteIllustration(
  illustration: Illustration,
  store: CleanupStore,
  options: { bucketURL: string; productionURL: string; dryRun: boolean; now: Date },
  fetcher: typeof fetch = fetch,
): Promise<CleanupResult> {
  const key = sourceKey(illustration.imageURL, options.bucketURL);
  if (!key || illustration.deleted) return "retained";
  // Recover interrupted runs of the old cleanup, which deleted before updating D1.
  const original = await store.readImage(key);
  const source = original ?? await store.readImage(`trash/${key}`);
  if (!source?.bytes.length) throw new Error(`R2 source and trash copy missing: ${key}`);
  const imageURL = `/${key}${key.endsWith(".webp") ? "" : ".webp"}`;
  const record: ArchiveRecord = {
    version: 1,
    illustrationId: illustration.id,
    sourceKey: key,
    imageURL,
    thumbnailURL: imageURL.replace("/full/", "/thumbnail/"),
    sha256: sha256(source.bytes),
    staticSha256: sha256(await normalizeWebp(source.bytes)),
    promotedAt: options.now.toISOString(),
  };
  const verification = await verifyProduction(record, options.productionURL, fetcher);
  if (verification !== "ready") return verification;
  if (original && await store.sourceEtag(key) !== original.etag) return "changed";
  if (options.dryRun) return "would-promote";
  // Persist recovery state BEFORE D1. Failed/CAS-lost updates cannot cause archival:
  // archival independently checks the current D1 row and all source references.
  await store.saveRecord(record);
  return await store.promote(illustration, record) ? "promoted" : "changed";
}

export async function archiveOriginal(
  record: ArchiveRecord,
  store: CleanupStore,
  options: { productionURL: string; dryRun: boolean; now: Date },
  fetcher: typeof fetch = fetch,
): Promise<CleanupResult> {
  const promotedAt = Date.parse(record.promotedAt);
  if (!Number.isFinite(promotedAt) || options.now.getTime() - promotedAt < ORIGINAL_RETENTION_MS) {
    return "retained";
  }
  const current = await store.readIllustration(record.illustrationId);
  if (
    !current || current.deleted || current.imageURL !== record.imageURL ||
    current.thumbnailURL !== record.thumbnailURL || await store.referencesSource(record.sourceKey)
  ) return "retained";
  const source = await store.readImage(record.sourceKey);
  if (source && sha256(source.bytes) !== record.sha256) return "changed";
  // Old recovery records predate normalization. Derive the expected static hash
  // from the verified original/trash without changing its retention date.
  let verificationRecord = record;
  if (!record.staticSha256) {
    const original = source ?? await store.readImage(`trash/${record.sourceKey}`);
    if (!original || sha256(original.bytes) !== record.sha256) return "changed";
    verificationRecord = { ...record, staticSha256: sha256(await normalizeWebp(original.bytes)) };
  }
  const verification = await verifyProduction(verificationRecord, options.productionURL, fetcher);
  if (verification !== "ready") return verification;
  if (options.dryRun) return "would-archive";
  if (source) await store.copyToTrash(record.sourceKey, source.etag);
  // Verify the archive, including when retrying after an interrupted delete.
  const archived = await store.readImage(`trash/${record.sourceKey}`);
  if (!archived || sha256(archived.bytes) !== record.sha256) {
    throw new Error(`Trash copy failed verification: ${record.sourceKey}`);
  }
  if (source) {
    if (
      await store.referencesSource(record.sourceKey) ||
      await store.sourceEtag(record.sourceKey) !== source.etag
    ) return "changed";
    await store.deleteSource(record.sourceKey);
  }
  await store.deleteRecord(record);
  return "archived";
}
