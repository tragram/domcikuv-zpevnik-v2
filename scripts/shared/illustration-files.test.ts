import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncIllustrationFile } from "./illustration-files";

let directory: string;
let fullPath: string;
let thumbnailPath: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "illustration-export-"));
  fullPath = path.join(directory, "full", "model.webp");
  thumbnailPath = path.join(directory, "thumbnail", "model.webp");
});
afterEach(() => {
  // Only remove the exact temporary directory created by this test.
  if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith("illustration-export-")) {
    throw new Error("Unexpected test directory");
  }
  fs.rmSync(directory, { recursive: true, maxRetries: 5, retryDelay: 50 });
});
async function image(background: string) {
  return sharp({ create: { width: 2, height: 2, channels: 3, background } }).png().toBuffer();
}
function existingPair(full: Uint8Array) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });
  fs.writeFileSync(fullPath, full);
  fs.writeFileSync(thumbnailPath, "existing thumbnail");
}
function fetchImage(bytes: Uint8Array) {
  return vi.fn<typeof fetch>(async () => new Response(new Uint8Array(bytes)));
}

describe("illustration file export", () => {
  it("refreshes an existing filename when source bytes change and invalidates its thumbnail", async () => {
    existingPair(await sharp(await image("red")).jpeg().toBuffer());
    const replacement = await image("blue");
    expect(await syncIllustrationFile("https://bucket.example/image", fullPath, thumbnailPath, fetchImage(replacement))).toBe("updated");
    expect(fs.readFileSync(fullPath)).toEqual(replacement);
    // An edited PNG must replace the old JPEG without implicit format conversion.
    expect((await sharp(fs.readFileSync(fullPath)).metadata()).format).toBe("png");
    expect(fs.existsSync(thumbnailPath)).toBe(false);
    expect(fs.readdirSync(path.dirname(fullPath))).toEqual(["model.webp"]);
  });

  it("keeps an unchanged thumbnail intact", async () => {
    const bytes = await image("red");
    existingPair(bytes);
    expect(await syncIllustrationFile("https://bucket.example/image", fullPath, thumbnailPath, fetchImage(bytes))).toBe("unchanged");
    expect(fs.readFileSync(thumbnailPath, "utf8")).toBe("existing thumbnail");
  });

  it("writes a missing full image for thumbnail generation", async () => {
    const bytes = await image("red");
    expect(await syncIllustrationFile("https://bucket.example/image", fullPath, thumbnailPath, fetchImage(bytes))).toBe("updated");
    expect(fs.readFileSync(fullPath)).toEqual(bytes);
  });

  it("preserves both existing files when an upstream fallback returns HTML", async () => {
    const bytes = await image("red");
    existingPair(bytes);
    await expect(syncIllustrationFile("https://bucket.example/image", fullPath, thumbnailPath, fetchImage(new TextEncoder().encode("<html>SPA</html>")))).rejects.toThrow();
    expect(fs.readFileSync(fullPath)).toEqual(bytes);
    expect(fs.readFileSync(thumbnailPath, "utf8")).toBe("existing thumbnail");
  });

  it("preserves existing files when the download fails", async () => {
    const bytes = await image("red");
    existingPair(bytes);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    await expect(syncIllustrationFile("https://bucket.example/image", fullPath, thumbnailPath, fetcher)).rejects.toThrow("HTTP 503");
    expect(fs.readFileSync(fullPath)).toEqual(bytes);
    expect(fs.readFileSync(thumbnailPath, "utf8")).toBe("existing thumbnail");
  });
});

describe("thumbnail generation workflow", () => {
  it("regenerates a valid WebP thumbnail from the refreshed full image", async () => {
    const generatedFull = path.join(directory, "songs", "illustrations", "song", "prompt", "full", "model.webp");
    const generatedThumbnail = generatedFull.replace(`${path.sep}full${path.sep}`, `${path.sep}thumbnail${path.sep}`);
    fs.mkdirSync(path.dirname(generatedFull), { recursive: true });
    fs.mkdirSync(path.dirname(generatedThumbnail), { recursive: true });
    fs.writeFileSync(generatedFull, await image("red"));
    fs.writeFileSync(generatedThumbnail, await image("red"));
    const edited = await image("blue");
    await syncIllustrationFile("https://bucket.example/image", generatedFull, generatedThumbnail, fetchImage(edited));
    const result = spawnSync(process.execPath, [path.resolve("scripts/generate-thumbnails.mjs")], { cwd: directory, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const thumbnail = fs.readFileSync(generatedThumbnail);
    const metadata = await sharp(thumbnail).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(128);
    const expected = await sharp(edited).resize({ width: 128 }).webp({ quality: 80 }).toBuffer();
    expect(thumbnail).toEqual(expected);
  });

  it("exits unsuccessfully when an image cannot produce a thumbnail", () => {
    const generatedFull = path.join(directory, "songs", "illustrations", "song", "prompt", "full", "model.webp");
    fs.mkdirSync(path.dirname(generatedFull), { recursive: true });
    fs.writeFileSync(generatedFull, "not an image");
    const result = spawnSync(process.execPath, [path.resolve("scripts/generate-thumbnails.mjs")], { cwd: directory, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refusing to publish incomplete assets");
  });
});
