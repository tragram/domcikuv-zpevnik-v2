import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

// Keep this policy shared by export, static migration and cleanup verification.
export async function normalizeWebp(bytes) {
  const image = sharp(bytes);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    throw new Error("Expected a single still image with dimensions");
  }
  if (metadata.format === "webp") {
    // Decode even pass-through files, so corrupt payloads cannot be published.
    await image.resize(1, 1).raw().toBuffer();
    return Buffer.from(bytes);
  }
  // Apply EXIF orientation before stripping source metadata during conversion.
  return image.autoOrient().webp({ quality: 80 }).toBuffer();
}

export function writeImageAtomic(filename, bytes) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, filename);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// Also visit historical, already-promoted files that D1 no longer exports from R2.
export async function normalizeStaticImages(root = process.cwd()) {
  let converted = 0;
  let thumbnails = 0;
  const fullImages = [];
  async function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink in illustrations: ${target}`);
      if (entry.isDirectory()) await visit(target);
      else if (path.basename(dir) === "full" && entry.name.endsWith(".webp")) fullImages.push(target);
    }
  }
  // Inventory first, rejecting symlinks before any files are read or replaced.
  await visit(path.join(root, "songs"));
  for (const target of fullImages) {
    const dir = path.dirname(target);
    const original = fs.readFileSync(target);
    const normalized = await normalizeWebp(original);
    const thumb = path.join(path.dirname(dir), "thumbnail", path.basename(target));
    const changed = !original.equals(normalized);
    let regenerate = changed || !fs.existsSync(thumb);
    if (!regenerate) {
      const image = sharp(fs.readFileSync(thumb));
      const metadata = await image.metadata();
      const fullMetadata = await sharp(normalized).metadata();
      regenerate = metadata.format !== "webp" || metadata.width !== 128 ||
        metadata.height !== Math.round(fullMetadata.height * 128 / fullMetadata.width);
      await image.resize(1, 1).raw().toBuffer();
    }
    if (regenerate) {
      const bytes = await sharp(normalized).resize({ width: 128 }).webp({ quality: 80 }).toBuffer();
      // Invalidate before replacing the full image; an interrupted run repairs it.
      fs.rmSync(thumb, { force: true });
      if (changed) { writeImageAtomic(target, normalized); converted++; }
      writeImageAtomic(thumb, bytes);
      thumbnails++;
    }
  }
  return { converted, thumbnails };
}
