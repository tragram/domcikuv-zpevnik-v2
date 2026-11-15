import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

/** Refresh mutable bucket images even when their exported filename already exists. */
export async function syncIllustrationFile(
  imageURL: string,
  fullPath: string,
  thumbnailPath: string,
  fetcher: typeof fetch = fetch,
): Promise<"updated" | "unchanged"> {
  const response = await fetcher(imageURL, {
    signal: AbortSignal.timeout(30_000),
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Image download returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  // Reject HTML fallbacks and invalid payloads before touching an existing pair.
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Downloaded image has no dimensions");
  if (fs.existsSync(fullPath) && fs.readFileSync(fullPath).equals(bytes)) return "unchanged";
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const temporaryPath = `${fullPath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, bytes);
    // Invalidate BEFORE replacing the full image, so an interrupted write cannot
    // leave a stale thumbnail that future runs mistake for an up-to-date one.
    fs.rmSync(thumbnailPath, { force: true });
    fs.renameSync(temporaryPath, fullPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return "updated";
}
