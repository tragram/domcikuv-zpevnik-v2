import fs from "node:fs";
import { normalizeWebp, writeImageAtomic } from "../sync/images.mjs";

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
  const bytes = await normalizeWebp(new Uint8Array(await response.arrayBuffer()));
  if (fs.existsSync(fullPath) && fs.readFileSync(fullPath).equals(bytes)) return "unchanged";
  fs.rmSync(thumbnailPath, { force: true });
  writeImageAtomic(fullPath, bytes);
  return "updated";
}
