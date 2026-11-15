import sharp from "sharp";
import { normalizeWebp } from "../sync/images.mjs";
import { describe, expect, it, vi } from "vitest";
import {
  archiveOriginal, ORIGINAL_RETENTION_MS, promoteIllustration, referencesBucketSource, sha256, sourceKey,
  type ArchiveRecord, type CleanupStore, type Illustration, type StoredImage,
} from "./illustration-cleanup";

const bucketURL = "https://bucket.example";
const productionURL = "https://songs.example";
const key = "songs/illustrations/song/model_v7/full/image-model";
const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
const original = { bytes, etag: '"original"' };
const now = new Date("2026-11-15T12:00:00Z");
const illustration: Illustration = {
  id: "illustration", imageURL: `${bucketURL}/${key}`,
  thumbnailURL: `/cdn-cgi/image/width=128/${bucketURL}/${key}`,
  updatedAt: new Date("2026-11-01T00:00:00Z"), deleted: false,
};
const record: ArchiveRecord = {
  version: 1, illustrationId: illustration.id, sourceKey: key,
  imageURL: `/${key}.webp`, thumbnailURL: `/${key.replace("/full/", "/thumbnail/")}.webp`,
  sha256: sha256(bytes), promotedAt: new Date(now.getTime() - ORIGINAL_RETENTION_MS).toISOString(),
};
const options = { bucketURL, productionURL, dryRun: false, now };

function fixture() {
  const images = new Map<string, StoredImage>([[key, original]]);
  const events: string[] = [];
  const store = {
    readImage: vi.fn(async (name: string) => images.get(name) ?? null),
    saveRecord: vi.fn(async () => { events.push("record"); }),
    promote: vi.fn(async () => { events.push("promote"); return true; }),
    readIllustration: vi.fn(async () => ({ ...illustration, ...record })),
    referencesSource: vi.fn(async () => false),
    copyToTrash: vi.fn(async () => { events.push("copy"); images.set(`trash/${key}`, original); }),
    sourceEtag: vi.fn(async () => original.etag),
    deleteSource: vi.fn(async () => { events.push("delete"); images.delete(key); }),
    deleteRecord: vi.fn(async () => { events.push("delete-record"); }),
  } satisfies CleanupStore;
  const fetcher = vi.fn<typeof fetch>(async () => new Response(bytes, {
    status: 200, headers: { "Content-Type": "image/webp" },
  }));
  return { store, fetcher, images, events };
}

describe("illustration promotion", () => {
  it("verifies normalized output separately from the untouched JPEG source", async () => {
    const f = fixture();
    const jpeg = await sharp(bytes).jpeg().toBuffer();
    const normalized = await normalizeWebp(jpeg);
    f.images.set(key, { bytes: jpeg, etag: original.etag });
    f.fetcher.mockImplementation(async () => new Response(normalized, { headers: { "Content-Type": "image/webp" } }));
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("promoted");
    expect(f.store.saveRecord).toHaveBeenCalledWith(expect.objectContaining({ sha256: sha256(jpeg), staticSha256: sha256(normalized) }));
    f.fetcher.mockImplementation(async () => new Response(jpeg, { headers: { "Content-Type": "image/webp" } }));
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("content-mismatch");
  });
  it("promotes byte-identical images without Content-Length and keeps originals", async () => {
    const f = fixture();
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("promoted");
    expect(f.events).toEqual(["record", "promote"]);
    expect(f.images.get(key)).toEqual(original);
    expect(f.store.saveRecord).toHaveBeenCalledWith(expect.objectContaining({
      imageURL: record.imageURL, thumbnailURL: record.thumbnailURL, sha256: record.sha256,
      promotedAt: now.toISOString(),
    }));
  });

  it("rejects different content even when byte sizes match", async () => {
    const f = fixture();
    f.fetcher.mockResolvedValue(new Response(new Uint8Array([3, 2, 1]), {
      headers: { "Content-Type": "image/webp", "Content-Length": "3" },
    }));
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("content-mismatch");
    expect(f.events).toEqual([]);
  });

  it.each(["full", "thumbnail"])("does not mistake the SPA fallback for the %s image", async (which) => {
    const f = fixture();
    if (which === "thumbnail") f.fetcher.mockResolvedValueOnce(new Response(bytes, { headers: { "Content-Type": "image/webp" } }));
    f.fetcher.mockResolvedValueOnce(new Response("<html>SPA</html>", { headers: { "Content-Type": "text/html" } }));
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("awaiting-deployment");
    expect(f.events).toEqual([]);
  });

  it("keeps missing assets pending", async () => {
    const f = fixture();
    f.fetcher.mockResolvedValue(new Response(null, { status: 404 }));
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("awaiting-deployment");
    expect(f.events).toEqual([]);
  });

  it.each([401, 403, 429, 500, 503])("reports HTTP %s as an operational failure", async status => {
    const f = fixture();
    f.fetcher.mockResolvedValue(new Response(null, { status }));
    await expect(promoteIllustration(illustration, f.store, options, f.fetcher)).rejects.toThrow(`HTTP ${status}`);
    expect(f.events).toEqual([]);
  });

  it("reports network failures instead of treating them as undeployed assets", async () => {
    const f = fixture();
    f.fetcher.mockRejectedValue(new Error("connection failed"));
    await expect(promoteIllustration(illustration, f.store, options, f.fetcher)).rejects.toThrow("connection failed");
    expect(f.events).toEqual([]);
  });

  it("makes no writes in dry-run", async () => {
    const f = fixture();
    expect(await promoteIllustration(illustration, f.store, { ...options, dryRun: true }, f.fetcher)).toBe("would-promote");
    expect(f.events).toEqual([]);
  });

  it.each([
    { ...illustration, imageURL: `https://elsewhere.example/${key}` },
    { ...illustration, deleted: true },
    { ...illustration, imageURL: record.imageURL },
  ])("ignores foreign, deleted, or already-promoted rows", async row => {
    const f = fixture();
    expect(await promoteIllustration(row, f.store, options, f.fetcher)).toBe("retained");
    expect(f.store.readImage).not.toHaveBeenCalled();
    expect(f.events).toEqual([]);
  });

  it("recovers an original trashed by the previous delete-before-update implementation", async () => {
    const f = fixture();
    f.images.delete(key);
    f.images.set(`trash/${key}`, original);
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("promoted");
    expect(f.events).toEqual(["record", "promote"]);
  });

  it("fails when both the original and trash copy are missing", async () => {
    const f = fixture();
    f.images.clear();
    await expect(promoteIllustration(illustration, f.store, options, f.fetcher)).rejects.toThrow("missing");
    expect(f.events).toEqual([]);
  });

  it("retains a source replaced during production verification", async () => {
    const f = fixture();
    f.store.sourceEtag.mockResolvedValue('"replacement"');
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("changed");
    expect(f.events).toEqual([]);
  });

  it("does not update D1 when saving recovery state fails", async () => {
    const f = fixture();
    f.store.saveRecord.mockRejectedValue(new Error("R2 unavailable"));
    await expect(promoteIllustration(illustration, f.store, options, f.fetcher)).rejects.toThrow("R2 unavailable");
    expect(f.store.promote).not.toHaveBeenCalled();
    expect(f.images.get(key)).toEqual(original);
  });

  it("preserves originals and recovery state when the D1 update fails", async () => {
    const f = fixture();
    f.store.promote.mockRejectedValue(new Error("D1 unavailable"));
    await expect(promoteIllustration(illustration, f.store, options, f.fetcher)).rejects.toThrow("D1 unavailable");
    expect(f.events).toEqual(["record"]);
    expect(f.images.get(key)).toEqual(original);
  });

  it("does not archive or delete when the conditional D1 update loses a race", async () => {
    const f = fixture();
    f.store.promote.mockResolvedValue(false);
    expect(await promoteIllustration(illustration, f.store, options, f.fetcher)).toBe("changed");
    expect(f.store.deleteSource).not.toHaveBeenCalled();
    expect(f.images.get(key)).toEqual(original);
  });
});

describe("delayed original archival", () => {
  it("reconciles a legacy JPEG record after static normalization", async () => {
    const f = fixture();
    const jpeg = await sharp(bytes).jpeg().toBuffer();
    const normalized = await normalizeWebp(jpeg);
    const legacy = { ...record, sha256: sha256(jpeg) };
    f.images.set(key, { bytes: jpeg, etag: original.etag });
    f.store.copyToTrash.mockImplementation(async () => { f.images.set(`trash/${key}`, { bytes: jpeg, etag: original.etag }); });
    f.fetcher.mockImplementation(async () => new Response(normalized, { headers: { "Content-Type": "image/webp" } }));
    expect(await archiveOriginal(legacy, f.store, options, f.fetcher)).toBe("archived");
    expect(f.images.get(`trash/${key}`)?.bytes).toEqual(jpeg);
  });
  it("retains originals throughout the 30-day grace period", async () => {
    const f = fixture();
    expect(await archiveOriginal({ ...record, promotedAt: new Date(now.getTime() - ORIGINAL_RETENTION_MS + 1).toISOString() }, f.store, options, f.fetcher)).toBe("retained");
    expect(f.events).toEqual([]);
    expect(f.store.readIllustration).not.toHaveBeenCalled();
  });

  it("verifies the trash copy before deleting an eligible unreferenced original", async () => {
    const f = fixture();
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("archived");
    expect(f.events).toEqual(["copy", "delete", "delete-record"]);
    expect(f.images.get(`trash/${key}`)).toEqual(original);
  });

  it("does not copy or delete during an archival dry-run", async () => {
    const f = fixture();
    expect(await archiveOriginal(record, f.store, { ...options, dryRun: true }, f.fetcher)).toBe("would-archive");
    expect(f.events).toEqual([]);
  });

  it("keeps sources referenced by any other D1 row", async () => {
    const f = fixture();
    f.store.referencesSource.mockResolvedValue(true);
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("retained");
    expect(f.events).toEqual([]);
  });

  it("keeps sources when the D1 promotion never committed", async () => {
    const f = fixture();
    f.store.readIllustration.mockResolvedValue({ ...illustration, ...record, imageURL: illustration.imageURL });
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("retained");
    expect(f.events).toEqual([]);
  });

  it("retains an original whose content changed since promotion", async () => {
    const f = fixture();
    f.images.set(key, { bytes: new Uint8Array([3, 2, 1]), etag: '"new"' });
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("changed");
    expect(f.events).toEqual([]);
  });

  it("keeps originals when production no longer matches", async () => {
    const f = fixture();
    f.fetcher.mockResolvedValue(new Response(new Uint8Array([9]), { headers: { "Content-Type": "image/webp" } }));
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("content-mismatch");
    expect(f.events).toEqual([]);
  });

  it("never deletes an original after a failed copy", async () => {
    const f = fixture();
    f.store.copyToTrash.mockRejectedValue(new Error("copy failed"));
    await expect(archiveOriginal(record, f.store, options, f.fetcher)).rejects.toThrow("copy failed");
    expect(f.store.deleteSource).not.toHaveBeenCalled();
  });

  it("never deletes an original if the archive copy has different bytes", async () => {
    const f = fixture();
    f.store.copyToTrash.mockImplementation(async () => { f.images.set(`trash/${key}`, { bytes: new Uint8Array([9]), etag: '"bad"' }); });
    await expect(archiveOriginal(record, f.store, options, f.fetcher)).rejects.toThrow("verification");
    expect(f.store.deleteSource).not.toHaveBeenCalled();
  });

  it("rechecks references immediately before deletion", async () => {
    const f = fixture();
    f.store.referencesSource.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("changed");
    expect(f.store.deleteSource).not.toHaveBeenCalled();
  });

  it("rechecks source ETag immediately before deletion", async () => {
    const f = fixture();
    f.store.sourceEtag.mockResolvedValue('"new"');
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("changed");
    expect(f.store.deleteSource).not.toHaveBeenCalled();
  });

  it("retries safely after deleting the original but before deleting the record", async () => {
    const f = fixture();
    f.images.delete(key);
    f.images.set(`trash/${key}`, original);
    expect(await archiveOriginal(record, f.store, options, f.fetcher)).toBe("archived");
    expect(f.events).toEqual(["delete-record"]);
  });
});

describe("bucket URL validation", () => {
  it("finds exact bucket references, including transformed thumbnails, without confusing static paths", () => {
    expect(referencesBucketSource(illustration.imageURL, key, bucketURL)).toBe(true);
    expect(referencesBucketSource(illustration.thumbnailURL, key, bucketURL)).toBe(true);
    expect(referencesBucketSource(`${illustration.imageURL}?download=true`, key, bucketURL)).toBe(true);
    expect(referencesBucketSource(record.imageURL, key, bucketURL)).toBe(false);
    expect(referencesBucketSource(record.thumbnailURL, key, bucketURL)).toBe(false);
    expect(referencesBucketSource(`${illustration.imageURL}-other`, key, bucketURL)).toBe(false);
    expect(referencesBucketSource(`https://elsewhere.example/${key}`, key, bucketURL)).toBe(false);
  });
  it("accepts only the configured origin and full illustration keys", () => {
    expect(sourceKey(illustration.imageURL, bucketURL)).toBe(key);
    for (const url of [
      `https://bucket.example.evil.test/${key}`, `https://other.example/${key}`,
      `${bucketURL}/${key}?download=true`, `${bucketURL}/backups/db.json`,
      `${bucketURL}/${key.replace("/full/", "/thumbnail/")}`, record.imageURL,
    ]) expect(sourceKey(url, bucketURL)).toBeUndefined();
  });
});
