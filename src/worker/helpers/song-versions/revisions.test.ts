import { withVersionMaintenance, backfillRevisionBaselines } from "../../../../scripts/shared/version-maintenance";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "src/lib/db/schema";
import { editorSubmitSchema } from "src/lib/contracts/editor-schema";
import type { AppDatabase } from "../../api/utils";
import {
  contentOf,
  loadVersion,
  restoreRevision,
  retrieveRevisions,
  reviseVersion,
  withVersionConflict,
} from "./revisions";
import {
  approveVersion,
  changeVersionStatus,
  mergeVersion,
  reclassifyVersion,
  saveSongVersion,
  setOfficialVersion,
} from "./writes";
import { songIllustrationFixture, versionHistoryFixture } from "./history.test-fixture";
import { getOwnSongbookEntries, setSongbookEntry } from "../favorite-helpers";
import { getSongVersionsByUser, publishedVersionIds, retrieveSingleSong, retrieveSongs } from "../song-helpers";
import { buildApp } from "../../api/utils";
import { songRoutes } from "../../api/admin/songs";
import editorApp from "../../api/editor";
import type { EditorSubmissionResponse } from "../../api/api-types";
import { versionNumbers } from "./numbering";
import { retrieveVersionSummaries } from "./queries";

let sqlite: DatabaseSync;
let db: AppDatabase;

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(versionHistoryFixture);
  sqlite.exec(songIllustrationFixture);
  sqlite.exec(readFileSync("drizzle/0008_sturdy_morgan_stark.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0009_living_snowbird.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0012_unique_import_copies.sql", "utf8"));
  sqlite.exec("PRAGMA foreign_keys = ON");
  const proxy = drizzle(
    async (query, params, method) => {
      const statement = sqlite.prepare(query);
      statement.setReturnArrays(true);
      const rows = statement.all(...params) as unknown as unknown[][];
      return { rows: method === "get" ? rows[0]! : rows };
    },
    { schema },
  );
  // Same SQLite transaction semantics as a D1 atomic batch; no policy decisions
  // or generated statements are mocked. Also exercised separately with Wrangler.
  Object.assign(proxy, {
    batch: async (
      queries: {
        toSQL(): { sql: string; params: (string | number | null)[] };
      }[],
    ) => {
      sqlite.exec("BEGIN");
      try {
        for (const query of queries) {
          const statement = query.toSQL();
          sqlite.prepare(statement.sql).run(...statement.params);
        }
        sqlite.exec("COMMIT");
        return [];
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  });
  db = proxy as unknown as AppDatabase;
  for (const [id, trusted, admin] of [
    ["owner", true, false],
    ["other", true, false],
    ["untrusted", false, false],
    ["admin", true, true],
  ] as const) {
    await db.insert(schema.user).values({
      id,
      name: id,
      email: `${id}@example.test`,
      isTrusted: trusted,
      isAdmin: admin,
    });
  }
  await db.insert(schema.song).values({ id: "song" });
});
afterEach(() => sqlite.close());

const input = (chordpro = "[C]Hello world") =>
  editorSubmitSchema.parse({ title: "Song", artist: "Artist", chordpro });
const initial = () => saveSongVersion(db, input(), "song", "owner");
async function edit(
  id: string,
  chordpro: string,
  actor = "owner",
  mode: "correction" | "new-version" = "correction",
) {
  const base = await loadVersion(db, "song", id);
  return saveSongVersion(
    db,
    {
      ...input(chordpro),
      baseVersionId: id,
      expectedRevision: base.revision,
      saveMode: mode,
    },
    "song",
    actor,
  );
}

describe("submitted revision history", () => {
  it("requires migration classification before approving incomplete submissions", async () => {
    const target = await initial();
    const proposal = await edit(target.id, "Reviewed correction", "untrusted");
    await db.update(schema.songSubmission).set({ submissionIntent: null })
      .where(eq(schema.songSubmission.versionId, proposal.id));
    await expect(approveVersion(db, "song", proposal.id, "admin", {
      expectedRevision: proposal.revision, force: true, expectedTargetRevision: target.revision,
    })).rejects.toMatchObject({ status: 400 });
    expect((await loadVersion(db, "song", target.id)).chordpro).toBe(target.chordpro);
    await db.update(schema.songSubmission).set({ submissionIntent: "update-parent", baseRevision: target.revision })
      .where(eq(schema.songSubmission.versionId, proposal.id));
    expect((await approveVersion(db, "song", proposal.id, "admin", {
      expectedRevision: proposal.revision,
    })).id).toBe(target.id);
  });

  async function importCopy(text = "[C]Source sheet", actor = "owner", site: "pisnicky-akordy" | "cifraclub" = "pisnicky-akordy") {
    const id = crypto.randomUUID();
    await db.insert(schema.songImport).values({ id, title: "Song", artist: "Artist", originalContent: text, url: `https://${site}.test/song`, sourceId: site, userId: actor });
    return saveSongVersion(db, input(text), "song", actor, id);
  }

  it("reuses the original import ID on refresh and rejects duplicate imports by another untrusted user", async () => {
    const original = await importCopy();
    const refreshed = await importCopy("Updated source");
    expect(refreshed.id).toBe(original.id);
    expect(refreshed.chordpro).toBe(original.chordpro);
    await expect(importCopy("Different content", "untrusted")).rejects.toMatchObject({ status: 409 });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
  });

  it("requires a revision before a trusted import can become official", async () => {
    const original = await importCopy();
    expect(original).toMatchObject({ status: "published", revision: 1 });
    expect((await db.query.song.findFirst())?.currentVersionId).toBeNull();

    await expect(setOfficialVersion(db, "song", original.id, "owner", original.revision)).rejects.toMatchObject({ status: 400 });
    const revised = await edit(original.id, "Reviewed sheet");
    expect(revised.revision).toBe(2);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
    expect(await retrieveSongs(db)).toMatchObject([{ isOfficial: true, officialVersionId: original.id }]);
  });

  it("clears a legacy official import while preserving its sheet and pin", async () => {
    const original = await importCopy();
    await db.update(schema.song).set({ currentVersionId: original.id }).where(eq(schema.song.id, "song"));
    await setSongbookEntry(db, "owner", "song", { pinnedVersionId: original.id });

    sqlite.exec(readFileSync("drizzle/0014_clear_unrevised_import_official.sql", "utf8"));

    expect(await retrieveSongs(db)).toMatchObject([{ versionId: original.id, isOfficial: false }]);
    expect(await getOwnSongbookEntries(db, "owner")).toMatchObject([{ pinnedVersionId: original.id }]);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({ status: "published", revision: original.revision });
  });

  it("uses the latest published version for public discovery until an official one is selected", async () => {
    const original = await importCopy();
    const latest = await importCopy("Another published sheet", "owner", "cifraclub");
    const first = await edit(original.id, "Revised sheet");
    await db.insert(schema.songVersion).values({ ...input("Pending sheet"), songId: "song", id: "draft", userId: "untrusted", createdAt: new Date("2090-01-01") });
    await db.update(schema.songVersion).set({ createdAt: new Date("2080-01-01"), revision: latest.revision + 1 }).where(eq(schema.songVersion.id, latest.id));
    expect(await retrieveSongs(db)).toMatchObject([{ versionId: latest.id, isOfficial: false, officialVersionId: null }]);
    expect(await retrieveSingleSong(db, "song")).toMatchObject({ versionId: latest.id, isOfficial: false });

    await setOfficialVersion(db, "song", first.id, "owner", first.revision);
    expect(await retrieveSongs(db)).toMatchObject([{ versionId: first.id, isOfficial: true }]);

    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", songRoutes);
    const clear = (expectedRevision: number) => app.request(`/song/versions/${first.id}/official`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision }),
    });
    expect((await clear(first.revision + 1)).status).toBe(409);
    expect((await clear(first.revision)).status).toBe(200);
    expect(await retrieveSingleSong(db, "song", first.id)).toMatchObject({ versionStatus: "published", versionRevision: first.revision, officialVersionId: null });
    expect(await retrieveSongs(db, new Date(0), true)).toMatchObject([{ versionId: latest.id, officialVersionId: null }]);
  });

  it("omits pending-only songs from public discovery and evicts cached songs with no public version", async () => {
    await importCopy("Pending source", "untrusted");
    expect(await retrieveSongs(db)).toEqual([]);
    expect(await retrieveSingleSong(db, "song")).toBeNull();

    const published = await importCopy("Published source", "owner", "cifraclub");
    await changeVersionStatus(db, "song", published.id, "owner", "archive", published.revision);
    expect(await retrieveSongs(db)).toEqual([]);
    expect(await retrieveSongs(db, new Date(0), true)).toMatchObject([{ id: "song", updateStatus: "deleted" }]);
  });

  it("makes the only published version official when an admin approves the import as-is", async () => {
    const original = await importCopy("[C]Source sheet", "untrusted");
    const published = await approveVersion(db, "song", original.id, "admin", {
      expectedRevision: original.revision, makeOfficial: false,
    });
    expect(published).toMatchObject({ status: "published", chordpro: original.chordpro });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
    expect((await retrieveRevisions(db, "song", original.id, "admin")).revisions[0]).toMatchObject({
      status: "published", previousStatus: "pending", previousContent: { chordpro: original.chordpro },
    });
  });

  it("keeps a first-revision import unofficial when its trusted owner saves it unchanged", async () => {
    const original = await importCopy();
    const saved = await edit(original.id, original.chordpro);
    expect(saved.revision).toBe(original.revision);
    expect((await db.query.song.findFirst())?.currentVersionId).toBeNull();
  });

  it("rejects a second raw version for the same provider URL even when the caller bypasses the lookup", async () => {
    const original = await importCopy();
    const row = await loadVersion(db, "song", original.id);
    await expect(db.insert(schema.songVersion).values({ ...row, id: "concurrent-copy" })).rejects.toThrow();
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
  });

  it("revises an import in place and retains the original sheet in revision history", async () => {
    const original = await importCopy();
    const revisedVersion = await saveSongVersion(db, { ...input("[D]Revised sheet"), baseVersionId: original.id, expectedRevision: original.revision, saveMode: "correction", archivePreviousOnPublish: false, makeOfficialOnPublish: false }, "song", "owner");
    expect(revisedVersion).toMatchObject({ id: original.id, status: "published", importId: original.importId, parentId: null, revision: 2 });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
    expect((await retrieveRevisions(db, "song", original.id, "owner")).revisions.at(-1)?.content.chordpro).toBe(original.chordpro);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(revisedVersion.id);
  });

  it("leaves the official choice open when another published import exists", async () => {
    const original = await importCopy();
    const other = await importCopy("Another sheet", "untrusted", "cifraclub");
    await approveVersion(db, "song", other.id, "admin", { expectedRevision: other.revision });
    await edit(original.id, "Revised sheet");
    expect((await db.query.song.findFirst())?.currentVersionId).toBeNull();
  });

  it("updates an owner's pending import without creating a second pending version", async () => {
    const original = await importCopy("Original source", "untrusted");
    const updated = await edit(original.id, "Corrected draft", "untrusted");
    expect(updated).toMatchObject({ id: original.id, status: "pending", chordpro: "Corrected draft", revision: 2 });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
  });

  it("keeps untrusted import corrections pending and applies approval to the original ID", async () => {
    const original = await importCopy();
    const draft = await saveSongVersion(db, { ...input("Suggested sheet edit"), baseVersionId: original.id, expectedRevision: original.revision, saveMode: "correction" }, "song", "untrusted");
    expect(draft).toMatchObject({ status: "pending", importId: null, submissionIntent: "update-parent", archivePreviousOnPublish: false, makeOfficialOnPublish: false });
    expect((await loadVersion(db, "song", original.id)).status).toBe("published");
    expect((await db.query.song.findFirst())?.currentVersionId).toBeNull();
    const published = await approveVersion(db, "song", draft.id, "admin", { expectedRevision: draft.revision, archivePrevious: false, makeOfficial: false });
    expect(published.id).toBe(original.id);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({
      status: "published", userId: "untrusted", editedBy: "untrusted", approvedBy: "admin",
    });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
    const revised = await edit(original.id, "Further correction", "admin");
    expect(revised).toMatchObject({ userId: "untrusted", editedBy: "admin" });
  });

  it("credits the first sheet editor when an admin revises their submission before approval", async () => {
    const original = await importCopy();
    const draft = await edit(original.id, "First sheet edit", "untrusted");
    const published = await saveSongVersion(db, {
      ...input("Reviewed sheet edit"), baseVersionId: draft.id, expectedRevision: draft.revision,
      saveMode: "correction",
    }, "song", "admin", undefined, { editAsPreviousAuthor: false, publish: true });
    expect(published).toMatchObject({
      id: original.id, userId: "untrusted", approvedBy: "admin", chordpro: "Reviewed sheet edit",
    });
  });

  it("corrects a published version in place without retiring its imported ancestor again", async () => {
    const original = await importCopy();
    const revisedVersion = await edit(original.id, "Revised sheet");
    const corrected = await edit(revisedVersion.id, "Follow-up edit");
    expect(corrected).toMatchObject({ id: original.id, parentId: null, revision: 3, importId: original.importId });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
  });

  it.each([true, false])("approves an unchanged imported submission in place with submitter attribution %s", async (editAsSubmitter) => {
    const original = await importCopy("[C]Source sheet", "untrusted");
    const published = await saveSongVersion(db, {
      ...input(original.chordpro), baseVersionId: original.id, expectedRevision: original.revision,
      saveMode: "new-version", archivePreviousOnPublish: true,
    }, "song", "admin", undefined, { publish: true, editAsSubmitter });
    expect(published).toMatchObject({ id: original.id, importId: original.importId,
      status: "published", userId: editAsSubmitter ? "untrusted" : "admin", approvedBy: "admin" });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
    expect(await db.query.songSubmission.findMany()).toHaveLength(0);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
  });

  it("credits an admin who makes the first sheet revision of another user's pending import", async () => {
    const original = await importCopy("Source", "untrusted");
    const revisedVersion = await saveSongVersion(db, {
      ...input("Edited source"), baseVersionId: original.id, expectedRevision: original.revision,
    }, "song", "admin", undefined, { publish: true, editAsPreviousAuthor: true });
    expect(revisedVersion).toMatchObject({ id: original.id, userId: "admin", status: "published", importId: original.importId, parentId: null });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
  });

  it("rejects approval of another user's import by a trusted non-admin", async () => {
    const original = await importCopy("Source", "untrusted");
    await expect(saveSongVersion(db, { ...input("Source"), baseVersionId: original.id,
      expectedRevision: original.revision }, "song", "other", undefined, { publish: true }))
      .rejects.toMatchObject({ status: 403 });
    expect((await loadVersion(db, "song", original.id)).status).toBe("pending");
  });

  it("reuses the imported identity without overwriting manual revisions", async () => {
    const original = await importCopy();
    const revisedVersion = await edit(original.id, "Revised sheet");
    const refreshed = await importCopy("Updated source sheet");
    expect(refreshed).toMatchObject({ id: original.id, status: "published", chordpro: "Revised sheet" });
    expect((await loadVersion(db, "song", revisedVersion.id)).chordpro).toBe("Revised sheet");
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(revisedVersion.id);
    expect((await importCopy("Updated source sheet")).revision).toBe(refreshed.revision);
    expect((await importCopy("Other site's sheet", "owner", "cifraclub")).id).not.toBe(original.id);
    const restored = await restoreRevision(db, "song", original.id, 1, refreshed.revision, "owner");
    expect(restored.chordpro).toBe(original.chordpro);
    await expect(mergeVersion(db, "song", restored.id, original.id, "admin", restored.revision, restored.revision)).rejects.toMatchObject({ status: 400 });
  });

  it("hides the provider for a revised import across song and version views", async () => {
    const original = await importCopy();
    await edit(original.id, "Revised sheet");
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      await next();
    }).route("/", songRoutes);
    expect(await retrieveSongs(db)).toMatchObject([{ versionId: original.id, externalSource: null }]);
    expect(await retrieveSingleSong(db, "song", original.id)).toMatchObject({
      externalSource: null, importOriginalContent: original.chordpro,
    });
    expect(await retrieveVersionSummaries(db, "song")).toMatchObject([{ id: original.id, importSourceId: null }]);
    expect(await getSongVersionsByUser(db, "owner")).toMatchObject([{ id: original.id, importSourceId: null, importId: original.importId }]);
    expect(await (await app.request("/versions")).json()).toMatchObject({ data: [{ id: original.id, importSourceId: null, importUrl: null }] });
    expect(await (await app.request("/withCurrentVersion")).json()).toMatchObject({ data: [{ id: "song", externalSource: null }] });
  });

  it("applies Admin metadata patches as revisions of the same imported version", async () => {
    const original = await importCopy();
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", songRoutes);
    const response = await app.request(`/song/versions/${original.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: original.revision, youtubeId: "abcdefghijk" }),
    });
    expect(response.status).toBe(200);
    const { data } = await response.json() as { data: { id: string; importId: string | null; youtubeId: string } };
    expect(data.id).toBe(original.id);
    expect(data).toMatchObject({ importId: original.importId, youtubeId: "abcdefghijk" });
    const withVideo = await loadVersion(db, "song", original.id);
    expect(withVideo).toMatchObject({ youtubeId: "abcdefghijk", status: "published", userId: "owner" });
    expect(await retrieveSingleSong(db, "song", original.id)).toMatchObject({ externalSource: { sourceId: "pisnicky-akordy" } });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
    const revisedVersion = await saveSongVersion(db, {
      ...contentOf(withVideo), chordpro: "Revised after the video was added",
      baseVersionId: original.id, expectedRevision: withVideo.revision,
    }, "song", "admin", undefined, { editAsPreviousAuthor: true });
    expect(revisedVersion).toMatchObject({ id: original.id, userId: "admin", youtubeId: "abcdefghijk" });
  });

  it("changes the author in place through the admin API and rejects stale updates", async () => {
    const imported = await importCopy();
    const original = await edit(imported.id, "Revised sheet");
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", songRoutes);
    const changeAuthor = (userId: string, expectedRevision = original.revision) =>
      app.request(`/song/versions/${original.id}/author`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, expectedRevision }),
      });

    expect((await changeAuthor("missing")).status).toBe(404);
    expect((await changeAuthor("other")).status).toBe(200);
    expect((await changeAuthor("owner")).status).toBe(409);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({
      id: original.id, importId: original.importId, chordpro: original.chordpro,
      userId: "other", editedBy: "admin", revision: original.revision + 1,
    });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
  });

  it.each([
    ["other", "published"],
    ["untrusted", "pending"],
  ] as const)("adds a separate version when %s submits a matching new draft", async (actor, status) => {
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: actor } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", editorApp);
    const songId = "cechomor-promeny";
    await db.insert(schema.song).values({ id: songId });
    const original = await saveSongVersion(db, editorSubmitSchema.parse({
      title: "Proměny", artist: "Čechomor", chordpro: "[C]Original arrangement",
    }), songId, "owner");

    const response = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Promeny", artist: "CECHOMOR", chordpro: "[D]New arrangement",
      }),
    });

    expect(response.status).toBe(200);
    const { data } = await response.json() as { data: EditorSubmissionResponse };
    expect(data.song).toMatchObject({ id: songId, currentVersionId: original.id });
    expect(data.version.id).not.toBe(original.id);
    const added = await loadVersion(db, songId, data.version.id);
    expect(added).toMatchObject({ status, parentId: null, chordpro: "[D]New arrangement" });
    if (status === "pending") {
      expect(added.submissionIntent).toBe("new-version");
      const approved = await approveVersion(db, songId, added.id, "admin", { expectedRevision: added.revision });
      expect(approved).toMatchObject({ id: added.id, status: "published" });
    }
    expect((await db.query.song.findFirst({ where: eq(schema.song.id, songId) }))?.currentVersionId).toBe(original.id);
    expect(await loadVersion(db, songId, original.id)).toMatchObject({
      status: "published", revision: original.revision, chordpro: "[C]Original arrangement",
    });
  });

  it("honors the editor's favorites choice when an admin saves on behalf of an author", async () => {
    const original = await initial();
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", editorApp);
    const save = (saveMode: string, addToFavorites: boolean, expectedRevision: number) =>
      app.request("/song", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: original.title, artist: original.artist, chordpro: "Reworked sheet",
          baseVersionId: original.id, expectedRevision, saveMode, addToFavorites, editAsPreviousAuthor: true,
        }),
      });

    expect((await save("correction", false, original.revision)).status).toBe(200);
    expect(await getOwnSongbookEntries(db, "admin")).toEqual([]);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({
      chordpro: "Reworked sheet", userId: "owner", editedBy: "admin",
    });
    const response = await save("new-version", true, original.revision + 1);
    expect(response.status).toBe(200);
    const { data } = await response.json() as { data: EditorSubmissionResponse };
    expect(data.version).toMatchObject({ userId: "owner", editedBy: "admin" });
    expect(await db.query.userFavoriteSongs.findMany()).toMatchObject([
      { userId: "admin", songId: "song", pinnedVersionId: data.version.id },
    ]);
  });

  it.each(["local", "imported"] as const)("renames a %s version in place through the admin API", async (kind) => {
    const original = kind === "imported" ? await importCopy("Source sheet", "untrusted") : await initial();
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", songRoutes);
    const rename = (label: string, expectedRevision: number) =>
      app.request(`/song/versions/${original.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, expectedRevision }),
      });

    expect((await rename("x".repeat(21), original.revision)).status).toBe(400);
    expect((await rename("  Acoustic   live  ", original.revision)).status).toBe(200);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({
      ...original,
      label: "Acoustic live",
      editedBy: "admin",
      revision: original.revision + 1,
      updatedAt: expect.any(Date),
    });
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
    expect((await rename("", original.revision)).status).toBe(409);
    expect((await rename("", original.revision + 1)).status).toBe(200);
    expect(await loadVersion(db, "song", original.id)).toMatchObject({
      label: null, revision: original.revision + 2,
    });
  });

  it("rejects imported merge sources so a replacement must be published as a new version", async () => {
    const original = await importCopy();
    const target = await saveSongVersion(db, input("Destination sheet"), "song", "owner");
    await expect(mergeVersion(db, "song", original.id, target.id, "admin", original.revision, target.revision)).rejects.toMatchObject({ status: 400 });
    expect(await loadVersion(db, "song", original.id)).toMatchObject({ status: "published", importId: original.importId, mergedIntoVersionId: null, chordpro: original.chordpro });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(target.id);
  });

  it("migrates formerly consumed imports back to unchanged archived source copies", async () => {
    const original = await importCopy();
    const revisedVersion = await saveSongVersion(db, { ...input("Revised sheet"), baseVersionId: original.id, expectedRevision: original.revision, saveMode: "new-version" }, "song", "owner");
    const archived = await loadVersion(db, "song", original.id);
    await reviseVersion(db, archived, { status: "deleted", mergedIntoVersionId: revisedVersion.id }, "admin");
    sqlite.exec(readFileSync("drizzle/0011_preserve_imported_sources.sql", "utf8"));
    expect(await loadVersion(db, "song", original.id)).toMatchObject({ status: "archived", mergedIntoVersionId: null, chordpro: original.chordpro, importId: original.importId });
    expect((await loadVersion(db, "song", revisedVersion.id)).chordpro).toBe("Revised sheet");
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(revisedVersion.id);
  });

  it("derives list numbers dynamically, counting labeled versions and breaking date ties by ID", async () => {
    await initial();
    await db.insert(schema.songVersion).values([
      { id: "b", songId: "song", userId: "owner", ...input(), createdAt: new Date(2000), status: "published" },
      { id: "a-tie", songId: "song", userId: "owner", ...input(), createdAt: new Date(1000), status: "published" },
      { id: "a", songId: "song", userId: "owner", ...input(), createdAt: new Date(1000), status: "published" },
      { id: "named", songId: "song", userId: "owner", ...input(), label: "Acoustic", createdAt: new Date(500), status: "published" },
    ]);
    const numbers = await versionNumbers(db, ["song"]);
    expect([...numbers.entries()].slice(0, 4)).toEqual([["named", 1], ["a", 2], ["a-tie", 3], ["b", 4]]);
    await setOfficialVersion(db, "song", "b", "admin", 1);
    await reviseVersion(db, await loadVersion(db, "song", "named"), { label: null }, "admin");
    expect(await versionNumbers(db, ["song"])).toEqual(numbers);
    await db.insert(schema.songVersion).values({ id: "backdated", songId: "song", userId: "owner", ...input(), createdAt: new Date(-1000) });
    expect([...(await versionNumbers(db, ["song"])).entries()]).toEqual([
      ["backdated", 1], ...[...numbers].map(([id, number]) => [id, number + 1]),
    ]);
    expect(await versionNumbers(db, [])).toEqual(new Map());
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'song_version_number'").all()).toEqual([]);
  });
  it("numbers admin versions within each song and lists recent edits first", async () => {
    await db.insert(schema.song).values({ id: "second-song" });
    const base = { ...input(), userId: "owner", createdAt: new Date(1000) };
    await db.insert(schema.songVersion).values([
      { ...base, id: "a", songId: "song", updatedAt: new Date(3000) },
      { ...base, id: "b", songId: "song", updatedAt: new Date(5000) },
      { ...base, id: "c", songId: "second-song", updatedAt: new Date(4000) },
    ]);
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      await next();
    }).route("/", songRoutes);
    expect(await (await app.request("/versions")).json()).toMatchObject({ data: [
      { id: "b", versionNumber: 2 }, { id: "c", versionNumber: 1 }, { id: "a", versionNumber: 1 },
    ] });
  });
  it.each(["merge", "approve", "reclassify"] as const)("deletes the consumed source through the Admin %s endpoint", async (action) => {
    const first = await initial();
    const proposal = await edit(first.id, "Reviewed sheet", "untrusted");
    const app = buildApp().use("*", async (c, next) => {
      c.set("db", db);
      c.set("USER", { id: "admin" } as NonNullable<typeof c.var.USER>);
      await next();
    }).route("/", songRoutes);
    const response = await app.request(`/song/versions/${proposal.id}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: proposal.revision,
        ...(action === "merge" ? { targetVersionId: first.id, expectedTargetRevision: first.revision } : {}),
        ...(action === "reclassify" ? { expectedParentRevision: first.revision } : {}),
      }),
    });
    expect(response.status).toBe(200);
    expect(await loadVersion(db, "song", proposal.id)).toMatchObject({ status: "deleted", mergedIntoVersionId: first.id });
    expect(await loadVersion(db, "song", first.id)).toMatchObject({ id: first.id, chordpro: "Reviewed sheet", status: "published" });
  });

  it("migrates legacy merged archives to deleted records while preserving actual alternatives", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "Approved correction", "untrusted");
    await approveVersion(db, "song", proposal.id, "admin", { expectedRevision: proposal.revision });
    const consumed = await loadVersion(db, "song", proposal.id);
    await reviseVersion(db, consumed, { status: "archived" }, "admin");
    const alternative = await edit(first.id, "Archived alternative", "owner", "new-version");
    await changeVersionStatus(db, "song", alternative.id, "owner", "archive", alternative.revision);
    const migration = readFileSync("drizzle/0010_delete_consumed_versions.sql", "utf8");
    sqlite.exec(migration);
    expect(await loadVersion(db, "song", proposal.id)).toMatchObject({ status: "deleted", mergedIntoVersionId: first.id, revision: consumed.revision + 2 });
    expect((await loadVersion(db, "song", alternative.id)).status).toBe("archived");
    const snapshots = await retrieveRevisions(db, "song", proposal.id, "admin");
    expect(snapshots.revisions[0].status).toBe("deleted");
    sqlite.exec(migration);
    expect((await loadVersion(db, "song", proposal.id)).revision).toBe(consumed.revision + 2);
  });
  it("ships only live published version IDs for offline catalogs", async () => {
    const first = await initial();
    const alternative = await edit(first.id, "Alternative", "owner", "new-version");
    await edit(first.id, "Pending suggestion", "untrusted", "new-version");
    expect((await publishedVersionIds(db)).get("song")?.sort()).toEqual([first.id, alternative.id].sort());
    await changeVersionStatus(db, "song", alternative.id, "owner", "archive", alternative.revision);
    expect((await publishedVersionIds(db, ["song"])).get("song")).toEqual([first.id]);
    await mergeVersion(db, "song", alternative.id, first.id, "admin", 2, first.revision);
    expect((await publishedVersionIds(db)).get("song")).toEqual([first.id]);
    expect((await publishedVersionIds(db, ["missing"])).size).toBe(0);
    expect((await publishedVersionIds(db, [])).size).toBe(0);
  });

  it("keeps catalog choices within D1's 100-parameter limit for 494 songs", async () => {
    const first = await initial();
    const parameterCounts: number[] = [];
    const limited = drizzle(async (query, params) => {
      parameterCounts.push(params.length);
      if (params.length > 100) throw new Error("D1 parameter limit exceeded");
      return { rows: sqlite.prepare(query).all(...params).map(Object.values) };
    }, { schema }) as unknown as AppDatabase;
    const ids = Array.from({ length: 494 }, (_, i) => i === 493 ? "song" : `missing-${i}`);
    expect((await publishedVersionIds(limited, ids)).get("song")).toEqual([first.id]);
    expect(parameterCounts).toHaveLength(5);
    expect(Math.max(...parameterCounts)).toBe(100);
  });

  it("loads alternative sheets for a large songbook in two statements", async () => {
    const first = await initial();
    const alternative = await edit(first.id, "Pinned sheet", "owner", "new-version");
    await setSongbookEntry(db, "owner", "song", { pinnedVersionId: alternative.id, capo: 3 });
    for (let i = 0; i < 161; i++) {
      const id = String(i);
      await db.insert(schema.song).values({ id });
      await db.insert(schema.songVersion).values({ ...input(), id, songId: id, userId: "owner", status: "published" });
      await db.update(schema.song).set({ currentVersionId: id }).where(eq(schema.song.id, id));
      await db.insert(schema.userFavoriteSongs).values({ userId: "owner", songId: id, pinnedVersionId: id });
    }

    const parameterCounts: number[] = [];
    const limited = drizzle(async (query, params) => {
      parameterCounts.push(params.length);
      return { rows: sqlite.prepare(query).all(...params).map(Object.values) };
    }, { schema }) as unknown as AppDatabase;
    const entries = await getOwnSongbookEntries(limited, "owner");
    expect(entries).toHaveLength(162);
    expect(entries.filter(entry => entry.song)).toHaveLength(1);
    expect(entries.find(entry => entry.songId === "song")).toMatchObject({
      capo: 3, song: { versionId: alternative.id, chordpro: "Pinned sheet",
        publishedVersionIds: expect.arrayContaining([first.id, alternative.id]) },
    });
    expect(parameterCounts).toHaveLength(2);
    expect(Math.max(...parameterCounts)).toBeLessThan(100);
  });

  it.each(["published", "archived"] as const)("restores a deleted %s alternative to its recorded state", async (status) => {
    const first = await initial();
    let alternative = await edit(first.id, "Other sheet", "owner", "new-version");
    if (status === "archived") alternative = await changeVersionStatus(db, "song", alternative.id, "admin", "archive", alternative.revision);
    const deleted = await changeVersionStatus(db, "song", alternative.id, "admin", "delete", alternative.revision);
    const restored = await changeVersionStatus(db, "song", alternative.id, "admin", "restore", deleted.revision);
    expect(restored.status).toBe(status);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(first.id);
  });

  it("requires a choice for a deleted baseline and can restore it for review", async () => {
    const first = await initial();
    await db.insert(schema.songVersion).values({ ...input(), id: "legacy", songId: "song", status: "deleted", userId: "owner" });
    await expect(changeVersionStatus(db, "song", "legacy", "admin", "restore", 1)).rejects.toMatchObject({ status: 422 });
    const restored = await changeVersionStatus(db, "song", "legacy", "admin", "restore", 1, "pending");
    const published = await approveVersion(db, "song", restored.id, "admin", { expectedRevision: restored.revision });
    expect(published.status).toBe("published");
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(first.id);
  });

  it("rejects a concurrent draft change between saving and approval", async () => {
    const proposal = await saveSongVersion(db, input("Draft"), "song", "untrusted");
    const batch = db.batch.bind(db);
    let injected = false;
    db.batch = (async (...args: Parameters<typeof db.batch>) => {
      const result = await batch(...args);
      if (!injected) {
        injected = true;
        sqlite.prepare("UPDATE song_version SET chordpro = 'Concurrent', revision = revision + 1 WHERE id = ?").run(proposal.id);
      }
      return result;
    }) as unknown as typeof db.batch;
    await expect(saveSongVersion(db, {
      ...input("Reviewed"), baseVersionId: proposal.id,
      expectedRevision: proposal.revision, saveMode: "new-version",
    }, "song", "admin", undefined, { publish: true })).rejects.toMatchObject({ status: 409 });
    expect((await loadVersion(db, "song", proposal.id)).status).toBe("pending");
  });

  it.each(["reject", "delete"] as const)("preserves correction intent through %s and restore", async (action) => {
    const first = await initial();
    const proposal = await edit(first.id, "Suggestion", "untrusted");
    const closed = await changeVersionStatus(db, "song", proposal.id, "admin", action, proposal.revision);
    const restored = await changeVersionStatus(db, "song", proposal.id, "admin", "restore", closed.revision);
    expect(restored.submissionIntent).toBe("update-parent");
    const accepted = await approveVersion(db, "song", proposal.id, "admin", { expectedRevision: restored.revision });
    expect(accepted.id).toBe(first.id);
  });

  it("allows explicit maintenance, backfills legacy baselines and reinstates guards on failure", async () => {
    const first = await initial();
    await withVersionMaintenance(db, async () => {
      await db.update(schema.song).set({ currentVersionId: null });
      await db.delete(schema.songRevision);
      await db.delete(schema.songVersion);
      await db.insert(schema.songVersion).values({ ...first, revision: 4 });
      await backfillRevisionBaselines(db);
    });
    expect(await db.query.songRevision.findMany()).toHaveLength(1);
    expect((await db.query.songRevision.findFirst())?.number).toBe(4);
    expect((await versionNumbers(db, ["song"])).get(first.id)).toBe(1);
    await expect(withVersionMaintenance(db, async () => { throw new Error("restore failed"); })).rejects.toThrow("restore failed");
    expect(() => sqlite.exec("DELETE FROM song_revision")).toThrow(/immutable/);
    expect(() => sqlite.exec("UPDATE song_version SET title = 'unguarded'")).toThrow(/VERSION_CONFLICT/);
  });

  it("includes the previous snapshot for diffs across page boundaries", async () => {
    const first = await initial();
    for (let number = 2; number <= 28; number++) {
      const base = await loadVersion(db, "song", first.id);
      await reviseVersion(db, base, { chordpro: `Sheet ${number}` }, "owner");
    }
    const page = await retrieveRevisions(db, "song", first.id, "owner");
    expect(page.revisions).toHaveLength(25);
    expect(page.revisions.at(-1)?.previousContent?.chordpro).toBe("Sheet 3");
    const older = await retrieveRevisions(
      db,
      "song",
      first.id,
      "owner",
      page.nextOffset!,
    );
    expect(older.revisions.at(-1)?.previousContent).toBeNull();
    expect(older.nextOffset).toBeNull();
  });
  it("backfills one honest baseline without changing legacy pins, official selection, or personal settings", () => {
    const legacy = new DatabaseSync(":memory:");
    try {
      legacy.exec(versionHistoryFixture);
      legacy.exec(`INSERT INTO user (id,name,email,email_verified,created_at,updated_at,last_login) VALUES ('legacy','Legacy','legacy@example.test',0,1,1,1);
        INSERT INTO song (id,created_at,updated_at) VALUES ('legacy-song',1,1);
        INSERT INTO song_version (id,song_id,status,title,artist,user_id,created_at,updated_at,chordpro) VALUES ('legacy-version','legacy-song','published','Legacy song','Artist','legacy',1,2,'Legacy sheet');
        UPDATE song SET current_version_id='legacy-version';
        INSERT INTO favorites (id,user_id,song_id,added_at,pinned_version_id,key_index,capo) VALUES (1,'legacy','legacy-song',1,'legacy-version',7,4);`);
      legacy.exec(readFileSync("drizzle/0008_sturdy_morgan_stark.sql", "utf8"));
      expect(
        legacy.prepare("SELECT number, content FROM song_revision").get(),
      ).toMatchObject({
        number: 1,
        content: expect.stringContaining("Legacy sheet"),
      });
      expect(
        legacy
          .prepare("SELECT pinned_version_id, key_index, capo FROM favorites")
          .get(),
      ).toMatchObject({
        pinned_version_id: "legacy-version",
        key_index: 7,
        capo: 4,
      });
      expect(
        legacy.prepare("SELECT current_version_id FROM song").get(),
      ).toMatchObject({ current_version_id: "legacy-version" });
    } finally {
      legacy.close();
    }
  });
  it("snapshots initial submissions, explicit corrections and restores while preserving IDs and provenance", async () => {
    const first = await initial();
    await db.insert(schema.userFavoriteSongs).values({
      userId: "other",
      songId: "song",
      pinnedVersionId: first.id,
      keyIndex: 2,
      capo: 3,
    });
    const corrected = await edit(first.id, "[C]Hello there");
    expect(corrected).toMatchObject({
      id: first.id,
      revision: 2,
      userId: "owner",
      parentId: null,
    });
    const restored = await restoreRevision(
      db,
      "song",
      first.id,
      1,
      corrected.revision,
      "owner",
    );
    expect(restored).toMatchObject({
      id: first.id,
      revision: 3,
      chordpro: first.chordpro,
    });
    const history = await retrieveRevisions(db, "song", first.id, "owner");
    expect(history.revisions.map((r) => r.number)).toEqual([3, 2, 1]);
    expect(history.revisions[1].content.chordpro).toBe("[C]Hello there");
    const favorite = await db.query.userFavoriteSongs.findFirst();
    expect(favorite).toMatchObject({
      pinnedVersionId: first.id,
      keyIndex: 2,
      capo: 3,
    });
    expect(() =>
      sqlite.exec("UPDATE song_revision SET content = '{}'"),
    ).toThrow(/immutable/);
    expect(() => sqlite.exec("DELETE FROM song_revision")).toThrow(/immutable/);
  });

  it("does not snapshot no-op corrections or manufacture self-parentage", async () => {
    const first = await initial();
    const unchanged = await edit(first.id, first.chordpro);
    expect(unchanged.revision).toBe(1);
    expect(unchanged.parentId).toBeNull();
    const unchangedSuggestion = await edit(
      first.id,
      first.chordpro,
      "untrusted",
    );
    expect(unchangedSuggestion.id).toBe(first.id);
    expect(await db.query.songVersion.findMany()).toHaveLength(1);
    expect(
      (await retrieveRevisions(db, "song", first.id, "owner")).revisions,
    ).toHaveLength(1);
  });

  it("keeps history private to the owner and admins, including every earlier pending snapshot", async () => {
    const first = await initial();
    await expect(
      retrieveRevisions(db, "song", first.id, "other"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      retrieveRevisions(db, "song", first.id, "admin"),
    ).resolves.toHaveProperty("revisions");
  });

  it("allows intentional large corrections and distinct identical alternatives", async () => {
    const first = await initial();
    const corrected = await edit(
      first.id,
      "A completely different sheet with many new words\n{chorus}\n[D]New chorus",
    );
    expect(corrected.id).toBe(first.id);
    const alternative = await edit(
      first.id,
      corrected.chordpro,
      "owner",
      "new-version",
    );
    expect(alternative.id).not.toBe(first.id);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(first.id);
    expect((await loadVersion(db, "song", first.id)).status).toBe("published");
  });

  it("keeps untrusted edits pending, then applies them as a revision without moving existing target pins", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "[C]Suggested words", "untrusted");
    expect(proposal).toMatchObject({
      status: "pending",
      submissionIntent: "update-parent",
      parentId: first.id,
      baseRevision: 1,
    });
    expect((await db.query.songSubmission.findFirst())?.versionId).toBe(
      proposal.id,
    );
    expect(
      sqlite
        .prepare("PRAGMA table_info(song_version)")
        .all()
        .map((column) => column.name),
    ).not.toContain("submission_intent");
    expect((await loadVersion(db, "song", first.id)).chordpro).toBe(
      first.chordpro,
    );
    await db.insert(schema.userFavoriteSongs).values({
      userId: "untrusted",
      songId: "song",
      pinnedVersionId: proposal.id,
      keyIndex: 5,
      capo: 2,
    });
    const accepted = await approveVersion(db, "song", proposal.id, "admin", {
      expectedRevision: proposal.revision,
    });
    expect(accepted).toMatchObject({
      id: first.id,
      revision: 2,
      userId: "owner",
      chordpro: proposal.chordpro,
      approvedBy: "admin",
    });
    expect(await db.query.songSubmission.findMany()).toHaveLength(0);
    expect(await loadVersion(db, "song", proposal.id)).toMatchObject({ status: "deleted", mergedIntoVersionId: first.id });
    expect(await db.query.userFavoriteSongs.findFirst()).toMatchObject({
      pinnedVersionId: first.id,
      keyIndex: 5,
      capo: 2,
    });
    await expect(
      changeVersionStatus(db, "song", proposal.id, "admin", "restore", 2),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("publishes a trusted non-owner's correction to the official sheet in place", async () => {
    const original = await initial();
    const corrected = await edit(original.id, "[D]New chords", "other");
    expect(corrected).toMatchObject({
      id: original.id, status: "published", userId: "owner", editedBy: "other",
      approvedBy: "other", revision: original.revision + 1,
    });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(original.id);
    expect(await db.query.songSubmission.findMany()).toHaveLength(0);
  });

  it("flags stale proposals and permits a reviewed admin override, preserving both states", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "Suggested", "untrusted");
    await db.update(schema.user).set({ isTrusted: true }).where(eq(schema.user.id, "untrusted"));
    const current = await edit(first.id, "Intervening change");
    await expect(
      approveVersion(db, "song", proposal.id, "admin", { expectedRevision: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      approveVersion(db, "song", proposal.id, "untrusted", {
        expectedRevision: 1,
        force: true,
        expectedTargetRevision: current.revision,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const accepted = await approveVersion(db, "song", proposal.id, "admin", {
      expectedRevision: 1,
      force: true,
      expectedTargetRevision: current.revision,
    });
    expect(accepted.chordpro).toBe("Suggested");
    expect(
      (await retrieveRevisions(db, "song", first.id, "admin")).revisions.map(
        (r) => r.content.chordpro,
      ),
    ).toEqual(["Suggested", "Intervening change", first.chordpro]);
  });

  it("aborts coupled writes when a revision changes between reading and writing", async () => {
    const first = await initial();
    await edit(first.id, "Concurrent change");
    await expect(
      withVersionConflict(() =>
        db.batch([
          reviseVersion(db, first, { chordpro: "Stale overwrite" }, "owner"),
          db
            .update(schema.song)
            .set({ currentVersionId: null })
            .where(eq(schema.song.id, "song")),
        ]),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(first.id);
    expect((await loadVersion(db, "song", first.id)).chordpro).toBe(
      "Concurrent change",
    );
  });

  it("rolls back earlier content and snapshot writes when a later batch guard fails", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "Proposed", "untrusted");
    await reviseVersion(db, proposal, { chordpro: "New proposal" }, "untrusted");
    await expect(
      withVersionConflict(() =>
        db.batch([
          reviseVersion(db, first, { chordpro: "Would be copied" }, "admin"),
          reviseVersion(db, proposal, { status: "archived" }, "admin"),
        ]),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await loadVersion(db, "song", first.id)).chordpro).toBe(
      first.chordpro,
    );
    expect(
      (await retrieveRevisions(db, "song", first.id, "owner")).revisions,
    ).toHaveLength(1);
  });

  it("rejects cross-song and deleted pins and preserves settings when changing a valid pin", async () => {
    const first = await initial();
    await setSongbookEntry(db, "owner", "song", {
      pinnedVersionId: first.id,
      keyIndex: 3,
      capo: 2,
    });
    await db.insert(schema.song).values({ id: "another" });
    await expect(
      setSongbookEntry(db, "owner", "another", { pinnedVersionId: first.id }),
    ).rejects.toMatchObject({ status: 400 });
    await setSongbookEntry(db, "owner", "song", { pinnedVersionId: null });
    expect(await db.query.userFavoriteSongs.findFirst()).toMatchObject({
      pinnedVersionId: null,
      keyIndex: 3,
      capo: 2,
    });
  });

  it("publishes explicit replacements atomically and keeps archived sheets and snapshots", async () => {
    const first = await initial();
    const next = await saveSongVersion(
      db,
      {
        ...input("Replacement"),
        baseVersionId: first.id,
        expectedRevision: 1,
        saveMode: "new-version",
        archivePreviousOnPublish: true,
        makeOfficialOnPublish: true,
      },
      "song",
      "owner",
    );
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(next.id);
    expect((await loadVersion(db, "song", first.id)).status).toBe("archived");
    expect(
      contentOf(
        (await retrieveRevisions(db, "song", first.id, "owner")).revisions[1]
          .content,
      ).chordpro,
    ).toBe(first.chordpro);
  });

  it.each([true, false])(
    "lets admins override publication requests to %s",
    async (requested) => {
      const first = await initial();
      // An untrusted owner can request a replacement but cannot publish it.
      await db
        .update(schema.user)
        .set({ isTrusted: false })
        .where(eq(schema.user.id, "owner"));
      const proposal = await saveSongVersion(
        db,
        {
          ...input("Replacement suggestion"),
          baseVersionId: first.id,
          expectedRevision: first.revision,
          saveMode: "new-version",
          makeOfficialOnPublish: requested,
          archivePreviousOnPublish: requested,
        },
        "song",
        "owner",
      );
      expect(proposal.status).toBe("pending");
      await edit(first.id, "Newer official sheet", "admin");
      // Removing both requests makes this an independent alternative, so it no
      // longer needs to override the source's intervening edit.
      await approveVersion(db, "song", proposal.id, "admin", {
        expectedRevision: proposal.revision,
        makeOfficial: !requested,
        archivePrevious: !requested,
        ...(!requested ? { force: true, expectedOfficialId: first.id, expectedTargetRevision: 2 } : {}),
      });
      expect((await db.query.song.findFirst())?.currentVersionId).toBe(
        requested ? first.id : proposal.id,
      );
      expect((await loadVersion(db, "song", first.id)).status).toBe(
        requested ? "published" : "archived",
      );
      expect(await db.query.songSubmission.findFirst()).toBeUndefined();
    },
  );

  it("reserves publication overrides for admins and requires an official replacement before archival", async () => {
    const first = await initial();
    const proposal = await edit(
      first.id,
      "Suggestion",
      "untrusted",
      "new-version",
    );
    await db
      .update(schema.user)
      .set({ isTrusted: true })
      .where(eq(schema.user.id, "untrusted"));
    await expect(
      approveVersion(db, "song", proposal.id, "untrusted", {
        expectedRevision: proposal.revision,
        makeOfficial: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      approveVersion(db, "song", proposal.id, "admin", {
        expectedRevision: proposal.revision,
        makeOfficial: false,
        archivePrevious: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await loadVersion(db, "song", proposal.id)).status).toBe("pending");
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(first.id);
  });

  it("lets admins hide consumed proposals without losing history or allowing restoration", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "Suggested correction", "untrusted");
    await approveVersion(db, "song", proposal.id, "admin", { expectedRevision: proposal.revision });
    const consumed = await loadVersion(db, "song", proposal.id);
    const deleted = await changeVersionStatus(db, "song", proposal.id, "admin", "delete", consumed.revision);
    expect(deleted).toMatchObject({ status: "deleted", mergedIntoVersionId: first.id });
    expect((await retrieveRevisions(db, "song", proposal.id, "admin")).revisions).toHaveLength(3);
    expect((await loadVersion(db, "song", first.id)).status).toBe("published");
    await expect(changeVersionStatus(db, "song", proposal.id, "admin", "restore", deleted.revision))
      .rejects.toMatchObject({ status: 400 });
  });

  it("cannot publish or select a pending proposal through the wrong operation", async () => {
    const first = await initial();
    const proposal = await edit(first.id, "Suggestion", "untrusted");
    await db.update(schema.user).set({ isTrusted: true }).where(eq(schema.user.id, "untrusted"));
    await expect(
      setOfficialVersion(db, "song", proposal.id, "other", 1),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      approveVersion(db, "song", proposal.id, "untrusted", { expectedRevision: 1 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("changes official selection without changing either sheet's revision or history", async () => {
    const first = await initial();
    const alternative = await edit(first.id, "Alternate sheet", "owner", "new-version");
    const selected = await setOfficialVersion(db, "song", alternative.id, "other", alternative.revision);
    expect(selected.revision).toBe(alternative.revision);
    expect((await loadVersion(db, "song", first.id)).revision).toBe(first.revision);
    expect((await retrieveRevisions(db, "song", alternative.id, "owner")).revisions).toHaveLength(1);
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(alternative.id);
    await expect(setOfficialVersion(db, "song", first.id, "other", first.revision + 1))
      .rejects.toMatchObject({ status: 409 });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(alternative.id);
  });

  it("approves a content correction after official selection changes, preserving that selection", async () => {
    const first = await initial();
    const correction = await edit(first.id, "Corrected words", "untrusted");
    const alternative = await edit(first.id, "Alternate sheet", "owner", "new-version");
    await setOfficialVersion(db, "song", alternative.id, "admin", alternative.revision);
    const applied = await approveVersion(db, "song", correction.id, "admin", { expectedRevision: correction.revision });
    expect(applied).toMatchObject({ id: first.id, chordpro: "Corrected words", revision: 2 });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(alternative.id);
  });

  it("still requires review when a replacement would override a changed official selection", async () => {
    const first = await initial();
    const replacement = await saveSongVersion(db, { ...input("Replacement"), baseVersionId: first.id,
      expectedRevision: first.revision, saveMode: "new-version", makeOfficialOnPublish: true }, "song", "untrusted");
    const alternative = await edit(first.id, "Alternate sheet", "owner", "new-version");
    await setOfficialVersion(db, "song", alternative.id, "admin", alternative.revision);
    await expect(approveVersion(db, "song", replacement.id, "admin", { expectedRevision: replacement.revision }))
      .rejects.toMatchObject({ status: 409 });
    await expect(approveVersion(db, "song", replacement.id, "admin", { expectedRevision: replacement.revision,
      force: true, expectedOfficialId: first.id, expectedTargetRevision: first.revision })).rejects.toMatchObject({ status: 409 });
    await approveVersion(db, "song", replacement.id, "admin", { expectedRevision: replacement.revision,
      force: true, expectedOfficialId: alternative.id, expectedTargetRevision: first.revision });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(replacement.id);
  });

  it("merges an existing official version into an alternative, preserving links, both histories, and personal settings", async () => {
    const first = await initial();
    const target = await edit(
      first.id,
      "Alternate sheet",
      "owner",
      "new-version",
    );
    await db.insert(schema.userFavoriteSongs).values({
      userId: "other",
      songId: "song",
      pinnedVersionId: first.id,
      keyIndex: 7,
      capo: 4,
    });
    await expect(
      mergeVersion(
        db,
        "song",
        first.id,
        target.id,
        "owner",
        first.revision,
        target.revision,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const merged = await mergeVersion(
      db,
      "song",
      first.id,
      target.id,
      "admin",
      first.revision,
      target.revision,
    );
    expect(merged.chordpro).toBe(first.chordpro);
    expect(await loadVersion(db, "song", first.id)).toMatchObject({
      status: "deleted",
      mergedIntoVersionId: target.id,
    });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(target.id);
    expect(await db.query.userFavoriteSongs.findFirst()).toMatchObject({
      pinnedVersionId: target.id,
      keyIndex: 7,
      capo: 4,
    });
    expect(
      (await retrieveRevisions(db, "song", first.id, "admin")).revisions,
    ).toHaveLength(2);
    expect(
      (await retrieveRevisions(db, "song", target.id, "admin")).revisions,
    ).toHaveLength(2);
  });

  it("reclassifies an official alternative into its parent atomically, keeping the parent's identity and name", async () => {
    const parent = await saveSongVersion(db, { ...input("Original"), label: "Parent name", description: "Parent description" }, "song", "owner");
    const mistaken = await saveSongVersion(db, { ...input("Corrected sheet"), label: "Mistaken alternative", description: "Other description",
      baseVersionId: parent.id, expectedRevision: parent.revision, saveMode: "new-version",
      archivePreviousOnPublish: true, makeOfficialOnPublish: true }, "song", "owner");
    await setSongbookEntry(db, "other", "song", { pinnedVersionId: mistaken.id, keyIndex: 7, capo: 3 });
    const archivedParent = await loadVersion(db, "song", parent.id);
    const applied = await reclassifyVersion(db, "song", mistaken.id, "admin", mistaken.revision, archivedParent.revision);
    expect(applied).toMatchObject({ id: parent.id, label: parent.label, description: parent.description,
      userId: parent.userId, chordpro: "Corrected sheet", status: "published" });
    expect((await db.query.song.findFirst())?.currentVersionId).toBe(parent.id);
    expect(await db.query.userFavoriteSongs.findFirst()).toMatchObject({ pinnedVersionId: parent.id, keyIndex: 7, capo: 3 });
    expect(await loadVersion(db, "song", mistaken.id)).toMatchObject({ status: "deleted", mergedIntoVersionId: parent.id });
    expect((await retrieveRevisions(db, "song", mistaken.id, "owner")).revisions).toHaveLength(2);
  });

  it("requires both the parent and source revisions reviewed during reclassification", async () => {
    const parent = await initial();
    const source = await edit(parent.id, "Separate version", "owner", "new-version");
    await edit(parent.id, "Intervening correction");
    await expect(reclassifyVersion(db, "song", source.id, "admin", source.revision, parent.revision))
      .rejects.toMatchObject({ status: 409 });
    expect((await loadVersion(db, "song", source.id)).status).toBe("published");
    await expect(reclassifyVersion(db, "song", parent.id, "admin", 2, 1)).rejects.toMatchObject({ status: 400 });
  });
});
