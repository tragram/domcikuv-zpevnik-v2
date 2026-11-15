import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";
import { z } from "zod";
import { defaultIllustrationId, promptFolder, sanitizePathSegment } from "../../src/lib/song-ids";

export const generatedPath = (file: string) =>
  /^songs\/chordpro\/[a-zA-Z0-9._-]+\.pro$/.test(file) ||
  /^songs\/illustrations\/[a-zA-Z0-9._-]+\/illustrations\.yaml$/.test(file) ||
  /^songs\/illustrations\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\/(full|thumbnail)\/[a-zA-Z0-9._-]+\.webp$/.test(file);

export function checkChanges(
  before: string[], after: string[], changed: string[],
  allowLargeDeletions = false,
) {
  if (changed.some(file => !generatedPath(file))) {
    throw new Error(`Unexpected export paths: ${changed.filter(file => !generatedPath(file)).join(", ")}`);
  }
  const current = new Set(after);
  const report: Record<string, { before: number; after: number; deleted: number }> = {};
  const groups = {
    songs: (p: string) => p.startsWith("songs/chordpro/") && p.endsWith(".pro"),
    metadata: (p: string) => p.endsWith("/illustrations.yaml"),
    images: (p: string) => p.startsWith("songs/illustrations/") && p.endsWith(".webp"),
  };
  for (const [name, matches] of Object.entries(groups)) {
    const previous = before.filter(matches);
    const next = after.filter(matches);
    const deleted = previous.filter(file => !current.has(file)).length;
    report[name] = { before: previous.length, after: next.length, deleted };
    if (name === "songs" && next.length === 0) throw new Error("Refusing an empty song export");
    if (previous.length && deleted / previous.length > 0.05 && !allowLargeDeletions) {
      throw new Error(`Suspicious ${name} deletion: ${deleted}/${previous.length} exceeds 5%. Review D1 and use the manual allow_large_deletions override only if intentional.`);
    }
  }
  return report;
}

const segment = z.string().regex(/^[a-zA-Z0-9._-]+$/).refine(s => s !== "." && s !== "..");
const metadataSchema = z.object({
  songId: segment,
  prompts: z.array(z.object({
    id: segment, songId: segment, text: z.string(),
    illustrations: z.array(z.object({ imageModel: z.string().min(1), filename: segment })),
  })),
});

export function inventory(root: string): string[] {
  const files: string[] = [];
  function visit(relative: string) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in snapshot: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
      else throw new Error(`Unsupported file in snapshot: ${file}`);
    }
  }
  visit("songs");
  return files;
}

/** Validate exported data independently of D1, without loading or executing it. */
export async function validateSnapshot(root: string, files: string[], changed: string[]) {
  let changedBytes = 0;
  for (const file of changed) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) continue; // Deletion counts are checked separately.
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) throw new Error(`Not a regular file: ${file}`);
    const limit = file.endsWith(".webp") ? 25 * 1024 * 1024 : 1024 * 1024;
    if (stat.size === 0 || stat.size > limit) throw new Error(`Unexpected file size (${stat.size} bytes): ${file}`);
    changedBytes += stat.size;
  }
  if (changedBytes > 250 * 1024 * 1024) throw new Error("Export changes exceed 250 MiB");
  const fileSet = new Set(files);
  const promptIds = new Set<string>();
  const illustrationIds = new Set<string>();
  const imagePaths = new Set<string>();
  let songs = 0;
  for (const file of files.filter(f => /^songs\/chordpro\/[^/]+\.pro$/.test(f))) {
    songs++;
    const songId = path.posix.basename(file, ".pro");
    const chordpro = fs.readFileSync(path.join(root, file), "utf8");
    for (const directive of ["title", "artist"]) {
      if (!new RegExp(`^\\{${directive}:\\s*[^}\\r\\n]+\\}`, "m").test(chordpro)) {
        throw new Error(`Missing ${directive}: ${file}`);
      }
    }
    const metadataFile = `songs/illustrations/${songId}/illustrations.yaml`;
    if (!fileSet.has(metadataFile)) throw new Error(`Missing metadata: ${metadataFile}`);
    const data = metadataSchema.parse(yaml.load(fs.readFileSync(path.join(root, metadataFile), "utf8")));
    if (data.songId !== songId) throw new Error(`Song ID mismatch: ${metadataFile}`);
    const songIllustrations = new Set<string>();
    const songPrompts = new Set<string>();
    for (const prompt of data.prompts) {
      if (prompt.songId !== songId || promptIds.has(prompt.id)) throw new Error(`Duplicate or foreign prompt: ${prompt.id}`);
      promptIds.add(prompt.id);
      songPrompts.add(prompt.id);
      const folder = sanitizePathSegment(promptFolder(songId, prompt.id));
      for (const illustration of prompt.illustrations) {
        const id = defaultIllustrationId(prompt.id, illustration.imageModel);
        if (illustrationIds.has(id)) throw new Error(`Duplicate illustration: ${id}`);
        illustrationIds.add(id);
        songIllustrations.add(id);
        // Historical snapshots used unsanitized illustration IDs.
        songIllustrations.add(`${prompt.id}_${illustration.imageModel}`);
        const full = `songs/illustrations/${songId}/${folder}/full/${illustration.filename}`;
        const thumb = full.replace("/full/", "/thumbnail/");
        for (const image of [full, thumb]) {
          if (!fileSet.has(image)) throw new Error(`Missing illustration asset: ${image}`);
          if (imagePaths.has(image)) throw new Error(`Illustrations collide at ${image}`);
          imagePaths.add(image);
        }
      }
    }
    const activeImage = chordpro.match(/^\{illustrationId:\s*([^}\r\n]+)\}/m)?.[1].trim();
    const activePrompt = chordpro.match(/^\{promptId:\s*([^}\r\n]+)\}/m)?.[1].trim();
    if (activeImage && !songIllustrations.has(activeImage)) throw new Error(`Unknown active illustration ${activeImage}: ${file}`);
    if (activePrompt && !songPrompts.has(activePrompt)) throw new Error(`Unknown active prompt ${activePrompt}: ${file}`);
  }
  if (!songs) throw new Error("Refusing an empty song export");
  // Include retained historical assets, even when absent from current metadata.
  const images = files.filter(f => /^songs\/illustrations\/[^/]+\/[^/]+\/(full|thumbnail)\/[^/]+\.webp$/.test(f));
  for (const image of images) {
    const pair = image.includes("/full/") ? image.replace("/full/", "/thumbnail/") : image.replace("/thumbnail/", "/full/");
    if (!fileSet.has(pair)) throw new Error(`Missing image pair: ${pair}`);
    // Decode pixels: checking an extension or headers alone misses corrupt payloads.
    await sharp(fs.readFileSync(path.join(root, image))).resize(1, 1).raw().toBuffer();
  }
  return { songs, prompts: promptIds.size, illustrations: illustrationIds.size, images: images.length, changedBytes };
}

export interface SyncActions {
  prepare(): Promise<string>;
  export(): Promise<void>;
  validate(base: string): Promise<boolean>;
  testAndBuild(): Promise<void>;
  latest(): Promise<string>;
  commit(): Promise<string>;
  push(): Promise<void>;
  discard(): Promise<void>;
}

/** Regenerate against new main; never rebase a stale database snapshot. */
export async function automaticSync(actions: SyncActions, attempts = 3): Promise<string | undefined> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const base = await actions.prepare();
    await actions.export();
    if (!await actions.validate(base)) return;
    await actions.testAndBuild();
    if (await actions.latest() !== base) {
      await actions.discard();
      continue;
    }
    const sha = await actions.commit();
    try {
      await actions.push();
      return sha;
    } catch (error) {
      // Only retry a rejected push if main actually advanced. Permission,
      // authentication and branch-protection errors must remain visible.
      const remote = await actions.latest();
      if (remote === sha) return sha; // Push committed but its response was lost.
      if (remote === base) throw error;
      await actions.discard();
    }
  }
  throw new Error(`Main advanced during all ${attempts} attempts; no stale snapshot was pushed. Rerun the sync.`);
}

export type BuildCheck = {
  name: string;
  head_sha: string;
  app?: { slug: string } | null;
  status: string;
  conclusion: string | null;
  details_url?: string;
};

export function deploymentResult(checks: BuildCheck[], sha: string, name: string) {
  const builds = checks.filter(c => c.head_sha === sha && c.name === name && c.app?.slug === "cloudflare-workers-and-pages");
  if (!builds.length || builds.some(c => c.status !== "completed")) return "pending";
  if (builds.some(c => c.conclusion !== "success")) throw new Error(`Cloudflare deployment failed: ${builds.map(c => `${c.conclusion} ${c.details_url ?? ""}`).join(", ")}`);
  return "success";
}
