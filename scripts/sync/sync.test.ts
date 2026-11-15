import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  automaticSync, deploymentResult, checkChanges, inventory, validateSnapshot,
  type SyncActions, type BuildCheck,
} from "./safeguards";


function actions() {
  return {
    prepare: vi.fn(async () => "base"), export: vi.fn(async () => {}),
    validate: vi.fn(async () => true), testAndBuild: vi.fn(async () => {}),
    latest: vi.fn(async () => "base"), commit: vi.fn(async () => "snapshot"),
    push: vi.fn(async () => {}), discard: vi.fn(async () => {}),
  } satisfies SyncActions;
}
describe("automatic snapshot publishing", () => {
  it("validates and builds before committing and pushing", async () => {
    const a = actions();
    expect(await automaticSync(a)).toBe("snapshot");
    expect(a.validate.mock.invocationCallOrder[0]).toBeLessThan(a.testAndBuild.mock.invocationCallOrder[0]);
    expect(a.testAndBuild.mock.invocationCallOrder[0]).toBeLessThan(a.commit.mock.invocationCallOrder[0]);
    expect(a.commit.mock.invocationCallOrder[0]).toBeLessThan(a.push.mock.invocationCallOrder[0]);
  });
  it("skips commits and deployment on unchanged exports", async () => {
    const a = actions(); a.validate.mockResolvedValue(false);
    expect(await automaticSync(a)).toBeUndefined();
    expect(a.commit).not.toHaveBeenCalled(); expect(a.testAndBuild).not.toHaveBeenCalled();
  });
  it.each(["export", "validate", "testAndBuild"] as const)("never pushes when %s fails", async stage => {
    const a = actions(); a[stage].mockRejectedValue(new Error("failed"));
    await expect(automaticSync(a)).rejects.toThrow("failed"); expect(a.push).not.toHaveBeenCalled();
  });
  it("regenerates and revalidates if main advances before commit", async () => {
    const a = actions(); a.latest.mockResolvedValueOnce("new").mockResolvedValue("base");
    expect(await automaticSync(a)).toBe("snapshot");
    expect(a.discard).toHaveBeenCalledOnce(); expect(a.export).toHaveBeenCalledTimes(2);
    expect(a.validate).toHaveBeenCalledTimes(2); expect(a.testAndBuild).toHaveBeenCalledTimes(2);
    expect(a.commit).toHaveBeenCalledOnce();
  });
  it("retries a concurrent non-fast-forward push from a fresh checkout", async () => {
    const a = actions(); a.push.mockRejectedValueOnce(new Error("rejected"));
    a.latest.mockResolvedValueOnce("base").mockResolvedValueOnce("new").mockResolvedValue("base");
    expect(await automaticSync(a)).toBe("snapshot"); expect(a.export).toHaveBeenCalledTimes(2);
    expect(a.discard).toHaveBeenCalledOnce();
  });
  it("reports permission errors instead of retrying or force-pushing", async () => {
    const a = actions(); a.push.mockRejectedValue(new Error("protected branch"));
    await expect(automaticSync(a)).rejects.toThrow("protected branch");
    expect(a.prepare).toHaveBeenCalledOnce(); expect(a.discard).not.toHaveBeenCalled();
  });
  it("recognizes a successful push when its response was lost", async () => {
    const a = actions(); a.push.mockRejectedValue(new Error("connection lost"));
    a.latest.mockResolvedValueOnce("base").mockResolvedValueOnce("snapshot");
    expect(await automaticSync(a)).toBe("snapshot"); expect(a.discard).not.toHaveBeenCalled();
  });
  it("bounds retries when main keeps changing", async () => {
    const a = actions(); a.latest.mockResolvedValue("new");
    await expect(automaticSync(a)).rejects.toThrow("all 3 attempts");
    expect(a.prepare).toHaveBeenCalledTimes(3); expect(a.push).not.toHaveBeenCalled();
  });
});

describe("Cloudflare deployment checks", () => {
  const check: BuildCheck = { name: "Workers Builds: app", head_sha: "snapshot", app: { slug: "cloudflare-workers-and-pages" }, status: "completed", conclusion: "success" };
  it("requires the exact commit, check name and Cloudflare app", () => {
    expect(deploymentResult([check], "snapshot", check.name)).toBe("success");
    expect(deploymentResult([check], "other", check.name)).toBe("pending");
    expect(deploymentResult([check], "snapshot", "other")).toBe("pending");
    expect(deploymentResult([{ ...check, app: { slug: "unrelated" } }], "snapshot", check.name)).toBe("pending");
  });
  it("waits for pending checks and rejects failed or skipped deployments", () => {
    expect(deploymentResult([], "snapshot", check.name)).toBe("pending");
    expect(deploymentResult([{ ...check, status: "in_progress" }], "snapshot", check.name)).toBe("pending");
    for (const conclusion of ["failure", "cancelled", "skipped", "neutral"]) {
      expect(() => deploymentResult([{ ...check, conclusion }], "snapshot", check.name)).toThrow("deployment failed");
    }
  });
});


describe("snapshot change policy", () => {
  const songs = Array.from({ length: 100 }, (_, i) => `songs/chordpro/song${i}.pro`);
  it("accepts normal additions, updates and deletions up to 5%", () => {
    expect(checkChanges(songs, songs.slice(5), songs.slice(0, 5)).songs.deleted).toBe(5);
    expect(() => checkChanges(songs, [...songs, "songs/chordpro/new.pro"], ["songs/chordpro/new.pro"])).not.toThrow();
  });
  it("blocks large deletions even if replacement songs hide the net count change", () => {
    const replacement = songs.slice(0, 6).map(s => s.replace("song", "new"));
    expect(() => checkChanges(songs, [...songs.slice(6), ...replacement], songs.slice(0, 6))).toThrow("exceeds 5%");
  });
  it("allows intentional bulk deletion only with the explicit override", () => {
    expect(checkChanges(songs, songs.slice(6), songs.slice(0, 6), true).songs.deleted).toBe(6);
  });
  it("rejects empty exports even with the deletion override", () => {
    expect(() => checkChanges(songs, [], songs, true)).toThrow("empty song export");
  });
  it.each([".dev.vars", "src/worker/index.ts", ".github/workflows/sync.yml", "songs/private.json", "songs/chordpro/../../secret.pro", "songs/illustrations/song/prompt/full/script.js", "songs/chordpro/example.pdf"])("rejects unexpected path %s even with override", file => {
    expect(() => checkChanges(songs, songs, [file], true)).toThrow("Unexpected export paths");
  });
  it("independently guards against mass image and metadata deletion", () => {
    for (const extra of [songs.map(s => s.replace("chordpro", "illustrations").replace(".pro", "/illustrations.yaml")), songs.map(s => s.replace("chordpro", "illustrations").replace(".pro", "/prompt/full/model.webp"))]) {
      expect(() => checkChanges([...songs, ...extra], [...songs, ...extra.slice(6)], extra.slice(0, 6))).toThrow("exceeds 5%");
    }
  });
});

let root: string;
const full = "songs/illustrations/song/prompt/full/model.webp";
const thumb = full.replace("/full/", "/thumbnail/");
const pro = "songs/chordpro/song.pro";
const meta = "songs/illustrations/song/illustrations.yaml";
function write(file: string, bytes: string | Buffer) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), bytes);
}
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-validation-"));
  write(pro, "{title: Song}\n{artist: Artist}\n{illustrationId: song_prompt_model}\n{promptId: song_prompt}\n\nLyrics");
  write(meta, yaml.dump({ songId: "song", prompts: [{ id: "song_prompt", songId: "song", text: "A scene", illustrations: [{ imageModel: "model", filename: "model.webp" }] }] }));
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  write(full, bytes); write(thumb, bytes);
});
afterEach(() => {
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("sync-validation-")) throw new Error("Unexpected temporary path");
  fs.rmSync(root, { recursive: true, maxRetries: 5, retryDelay: 50 });
});
describe("exported snapshot integrity", () => {
  it("accepts the existing naming convention without requiring WebP conversion", async () => {
    expect(await validateSnapshot(root, inventory(root), [full])).toMatchObject({ songs: 1, illustrations: 1, images: 2 });
  });
  it("rejects missing thumbnails", async () => {
    fs.unlinkSync(path.join(root, thumb));
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Missing illustration asset");
  });
  it("rejects corrupt image bytes despite an image extension", async () => {
    write(full, "not an image"); await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow();
  });
  it("rejects broken active illustration references", async () => {
    write(pro, "{title: Song}\n{artist: Artist}\n{illustrationId: missing}");
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Unknown active illustration");
  });
  it("rejects malformed metadata and foreign song IDs", async () => {
    write(meta, "songId: [invalid\n"); await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow();
    write(meta, yaml.dump({ songId: "other", prompts: [] }));
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Song ID mismatch");
  });
  it("rejects colliding illustration paths and IDs", async () => {
    const doc = yaml.load(fs.readFileSync(path.join(root, meta), "utf8")) as { prompts: { illustrations: unknown[] }[] };
    doc.prompts[0].illustrations.push(doc.prompts[0].illustrations[0]); write(meta, yaml.dump(doc));
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Duplicate illustration");
  });
  it("rejects oversized changed files before parsing them", async () => {
    write(pro, Buffer.alloc(1024 * 1024 + 1));
    await expect(validateSnapshot(root, inventory(root), [pro])).rejects.toThrow("Unexpected file size");
  });
  it.skipIf(process.platform === "win32")("rejects symlinks before reading their targets", () => {
    // Linux CI exercises real symlinks; the Windows sandbox forbids their creation.
    fs.symlinkSync(path.join(root, "songs/chordpro"), path.join(root, "songs/link"), "dir");
    expect(() => inventory(root)).toThrow("Symlink in snapshot");
  });
});
