import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeWebp, normalizeStaticImages } from "./images.mjs";

let root: string;
let full: string;
let thumb: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "webp-normalization-"));
  full = path.join(root, "songs/illustrations/historical/prompt/full/image.webp");
  thumb = full.replace(`${path.sep}full${path.sep}`, `${path.sep}thumbnail${path.sep}`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.mkdirSync(path.dirname(thumb), { recursive: true });
});
afterEach(() => {
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("webp-normalization-")) throw new Error("Unexpected temporary path");
  fs.rmSync(root, { recursive: true, maxRetries: 5, retryDelay: 50 });
});
const source = () => sharp({ create: { width: 256, height: 128, channels: 4, background: "#ff000080" } });

describe("static WebP normalization", () => {
  it.each(["jpeg", "png"] as const)("migrates historical %s images, repairs thumbnails and is idempotent", async format => {
    fs.writeFileSync(full, await source().toFormat(format).toBuffer());
    fs.writeFileSync(thumb, await source().jpeg().toBuffer());
    expect(await normalizeStaticImages(root)).toEqual({ converted: 1, thumbnails: 1 });
    const fullBytes = fs.readFileSync(full);
    const thumbBytes = fs.readFileSync(thumb);
    expect(await sharp(fullBytes).metadata()).toMatchObject({ format: "webp", width: 256, height: 128 });
    expect(await sharp(thumbBytes).metadata()).toMatchObject({ format: "webp", width: 128, height: 64 });
    expect(await normalizeStaticImages(root)).toEqual({ converted: 0, thumbnails: 0 });
    expect(fs.readFileSync(full)).toEqual(fullBytes);
    expect(fs.readFileSync(thumb)).toEqual(thumbBytes);
  });
  it("preserves valid WebP bytes and alpha without recompressing", async () => {
    const bytes = await source().webp({ lossless: true }).toBuffer();
    expect(await normalizeWebp(bytes)).toEqual(bytes);
    expect((await sharp(await normalizeWebp(await source().png().toBuffer())).metadata()).hasAlpha).toBe(true);
  });
  it("preserves displayed orientation when stripping JPEG metadata", async () => {
    const jpeg = await source().jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const metadata = await sharp(await normalizeWebp(jpeg)).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 128, height: 256 });
    expect(metadata.orientation).toBeUndefined();
  });
  it("repairs a mislabeled thumbnail even when the full image is already WebP", async () => {
    const bytes = await source().webp().toBuffer();
    fs.writeFileSync(full, bytes);
    fs.writeFileSync(thumb, await source().resize(128).jpeg().toBuffer());
    expect(await normalizeStaticImages(root)).toEqual({ converted: 0, thumbnails: 1 });
    expect(fs.readFileSync(full)).toEqual(bytes);
  });
  it("does not touch an existing pair if the full image cannot be decoded", async () => {
    fs.writeFileSync(full, "invalid");
    fs.writeFileSync(thumb, "keep");
    await expect(normalizeStaticImages(root)).rejects.toThrow();
    expect(fs.readFileSync(thumb, "utf8")).toBe("keep");
  });
});
