import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import yaml from "js-yaml";
import sharp from "sharp";
import { assignSnapshotVersions, eligibleSnapshotVersion } from "../shared/song-snapshot";
import type { AppDatabase } from "../../src/worker/api/utils";
import { renderSnapshotSheet } from "./render-song";
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
  const songs = Array.from({ length: 100 }, (_, i) => `songs/song${i}/song.yaml`);
  it("accepts normal additions, updates and deletions up to 5%", () => {
    expect(checkChanges(songs, songs.slice(5), songs.slice(0, 5)).songs.deleted).toBe(5);
    expect(() => checkChanges(songs, [...songs, "songs/new/song.yaml"], ["songs/new/song.yaml"])).not.toThrow();
  });
  it("blocks large deletions even if replacement songs hide the net count change", () => {
    const replacement = songs.slice(0, 6).map(s => s.replace("/song", "/new"));
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
  it("independently guards against mass image and sheet deletion", () => {
    for (const extra of [songs.map(s => s.replace("song.yaml", "2026-01-01.pro")), songs.map(s => s.replace("song.yaml", "prompt/full/model.webp"))]) {
      expect(() => checkChanges([...songs, ...extra], [...songs, ...extra.slice(6)], extra.slice(0, 6))).toThrow("exceeds 5%");
    }
  });
});

let root: string;
const full = "songs/song/prompt/full/model.webp";
const thumb = full.replace("/full/", "/thumbnail/");
const pro = "songs/song/v1.pro";
const officialVersion = { id: "official", revision: 1, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
const meta = "songs/song/song.yaml";
function write(file: string, bytes: string | Buffer) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), bytes);
}
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-validation-"));
  write(pro, "{title: Song}\n{artist: Artist}\n{illustrationId: song_prompt_model}\n{promptId: song_prompt}\n\nLyrics");
  write(meta, yaml.dump({ songId: "song", official: "v1", versions: { v1: officialVersion }, prompts: [{ id: "song_prompt", songId: "song", text: "A scene", summaryModel: "model", summaryPromptVersion: "v1", createdAt: new Date(0), illustrations: [{ imageModel: "model", filename: "model.webp", createdAt: 0 }] }] }));
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
  write(full, bytes); write(thumb, await sharp(bytes).resize(128).webp().toBuffer());
});
afterEach(() => {
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("sync-validation-")) throw new Error("Unexpected temporary path");
  fs.rmSync(root, { recursive: true, maxRetries: 5, retryDelay: 50 });
});
describe("exported snapshot integrity", () => {
  it("accepts genuine WebP pairs", async () => {
    expect(await validateSnapshot(root, inventory(root), [full])).toMatchObject({ songs: 1, illustrations: 1, images: 2 });
  });
  it.each(["jpeg", "png"] as const)("rejects %s bytes disguised as WebP", async format => {
    write(full, await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).toFormat(format).toBuffer());
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Expected still WebP");
  });
  it("rejects incorrectly sized thumbnails", async () => {
    write(thumb, await sharp({ create: { width: 64, height: 64, channels: 3, background: "red" } }).webp().toBuffer());
    await expect(validateSnapshot(root, inventory(root), [])).rejects.toThrow("Invalid thumbnail dimensions");
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
    write(meta, yaml.dump({ songId: "other", official: "v1", versions: { v1: officialVersion }, prompts: [] }));
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
    fs.symlinkSync(path.join(root, "songs/song"), path.join(root, "songs/link"), "dir");
    expect(() => inventory(root)).toThrow("Symlink in snapshot");
  });
});

describe("parallel version snapshots", () => {
  const alternate = "songs/song/v2.pro";
  const sheet = "{title: Song}\n{artist: Artist}\n\n[C]Lyrics";

  it("uses revision count for imports and still requires an available version", () => {
    const raw = { status: "published", mergedIntoVersionId: null, importId: "source", revision: 1 };
    expect(eligibleSnapshotVersion(raw)).toBe(false);
    expect(eligibleSnapshotVersion({ ...raw, revision: 2 })).toBe(true);
    expect(eligibleSnapshotVersion({ ...raw, importId: null })).toBe(true);
    expect(eligibleSnapshotVersion({ ...raw, revision: 2, status: "archived" })).toBe(false);
    expect(eligibleSnapshotVersion({ ...raw, revision: 2, mergedIntoVersionId: "other" })).toBe(false);
  });

  it("keeps version numbers across edits, archive, restoration, and new versions", () => {
    const original = {
      id: "original", createdAt: new Date(0), updatedAt: new Date(0),
      label: null, description: null, revision: 1, youtubeId: null,
    };
    const alternate = { ...original, id: "alternate", createdAt: new Date(1000) };
    expect(assignSnapshotVersions([alternate, original]).versions).toMatchObject({
      v1: { id: "original" }, v2: { id: "alternate" },
    });
    const prior = { v1: "original", v2: "alternate", v3: "old" };
    const edited = { ...alternate, label: "New label", revision: 2, updatedAt: new Date(2000) };
    expect(assignSnapshotVersions([edited, { ...original, id: "new" }], prior)).toMatchObject({
      versions: { v2: { id: "alternate", label: "New label", revision: 2 }, v4: { id: "new" } },
      reserved: { v1: "original", v3: "old" },
    });
    expect(assignSnapshotVersions([original], { ...prior, v4: "new" })).toMatchObject({
      versions: { v1: { id: "original" } },
      reserved: { v2: "alternate", v3: "old", v4: "new" },
    });
  });

  it("checks orphaned sheets and duplicate IDs, and counts songs separately", async () => {
    write(alternate, sheet);
    await expect(validateSnapshot(root, inventory(root), [alternate])).rejects.toThrow("Orphaned sheet");
    const manifest = yaml.load(fs.readFileSync(path.join(root, meta), "utf8")) as { versions: Record<string, typeof officialVersion> };
    manifest.versions.v2 = { ...officialVersion };
    write(meta, yaml.dump(manifest));
    await expect(validateSnapshot(root, inventory(root), [alternate])).rejects.toThrow("Duplicate version ID");
    manifest.versions.v2.id = "alternate";
    write(meta, yaml.dump(manifest));
    await expect(validateSnapshot(root, inventory(root), [alternate])).resolves.toMatchObject({ songs: 1, sheets: 2 });
  });

  it("seeds official and alternate versions with their exported IDs and metadata", async () => {
    const { processAndMigrateSongs } = await import("../staticData2DB");
    const version = {
      songId: "song", title: "Song", artist: "Artist", key: "C", chordpro: "[C]Lyrics",
      createdAt: new Date("2026-10-01T01:00:00Z"), updatedAt: new Date("2026-10-01T02:00:00Z"),
      language: "other", tempo: null, capo: 2, range: null, startMelody: null,
      id: "alternate", label: "Jednodušší akordy", description: "A {simpler} sheet", youtubeId: "abcdefghijk", revision: 3,
    };
    write(alternate, renderSnapshotSheet(version));
    const manifest = yaml.load(fs.readFileSync(path.join(root, meta), "utf8")) as {
      versions: Record<string, typeof officialVersion>;
    };
    Object.assign(manifest.versions, assignSnapshotVersions([version], { v1: "official" }).versions);
    write(meta, yaml.dump(manifest));

    const sqlite = new DatabaseSync(":memory:");
    try {
      for (const file of fs.readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) {
        sqlite.exec(fs.readFileSync(path.join("drizzle", file), "utf8"));
      }
      const db = drizzle(async (sql, params, method) => {
        const rows = sqlite.prepare(sql).all(...params).map(Object.values);
        return { rows: method === "get" ? rows[0] : rows };
      }) as unknown as AppDatabase;
      await processAndMigrateSongs(db, path.join(root, "songs"));
      expect(sqlite.prepare("SELECT current_version_id FROM song WHERE id = 'song'").get())
        .toMatchObject({ current_version_id: "official" });
      expect(sqlite.prepare("SELECT * FROM song_version WHERE id = 'alternate'").get()).toMatchObject({
        song_id: "song", chordpro: "[C]Lyrics", label: version.label,
        description: version.description, youtube_id: version.youtubeId, revision: version.revision, status: "published",
      });
    } finally {
      sqlite.close();
    }
  });
});
