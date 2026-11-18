import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "src/lib/db/schema";
import type { AppDatabase } from "../../api/utils";
import { retrieveVersionSummaries } from "./queries";
import { publishedVersionIds } from "../song-helpers";
import { selectableVersionIds } from "src/lib/song-selection";
import type { SongbookEntryApi } from "../../api/api-types";

let sqlite: DatabaseSync;
let db: AppDatabase;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, nickname TEXT);
    CREATE TABLE song (id TEXT PRIMARY KEY, current_version_id TEXT, deleted INTEGER);
    CREATE TABLE song_version (
      id TEXT PRIMARY KEY, song_id TEXT, status TEXT, key TEXT, capo INTEGER,
      created_at INTEGER, user_id TEXT
    );
    INSERT INTO user VALUES ('viewer', 'Viewer', NULL), ('other', 'Other', 'Anna');
    INSERT INTO song VALUES ('song', 'official', 0), ('another', 'unrelated', 0), ('removed', 'removed-version', 1);
    INSERT INTO song_version VALUES
      ('earlier', 'song', 'archived', 'C', 0, 10, 'other'),
      ('official', 'song', 'published', 'D', 2, 20, 'other'),
      ('own-pending', 'song', 'pending', 'E', 0, 30, 'viewer'),
      ('foreign-pending', 'song', 'pending', 'F', 0, 40, 'other'),
      ('rejected', 'song', 'rejected', 'G', 0, 50, 'viewer'),
      ('deleted', 'song', 'deleted', 'A', 0, 60, 'viewer'),
      ('unrelated', 'another', 'published', 'C', 0, 70, 'other'),
      ('removed-version', 'removed', 'published', 'C', 0, 80, 'other');
    ALTER TABLE song_version ADD label TEXT;
    ALTER TABLE song_version ADD description TEXT;
    ALTER TABLE song_version ADD updated_at INTEGER DEFAULT 0;
    ALTER TABLE song_version ADD revision INTEGER DEFAULT 1;
    ALTER TABLE song_version ADD import_id TEXT;
    ALTER TABLE song_version ADD merged_into_version_id TEXT;
    CREATE TABLE song_import (id TEXT PRIMARY KEY, source_id TEXT);
    CREATE TABLE favorites (id INTEGER PRIMARY KEY, user_id TEXT, song_id TEXT, added_at INTEGER, pinned_version_id TEXT, key_index INTEGER, capo INTEGER);
  `);
  // Exercise the real relational queries against SQLite without a Worker runtime.
  db = drizzle(async (sql, params, method) => {
    const rows = sqlite.prepare(sql).all(...params).map(Object.values);
    return { rows: method === "get" ? rows[0]! : rows };
  }, { schema }) as unknown as AppDatabase;
});

afterEach(() => sqlite.close());

describe("song version summaries", () => {
  it("agrees with offline picker IDs for guests, saved archives, and own pending edits", async () => {
    const publishedIds = (await publishedVersionIds(db, ["song"])).get("song")!;
    const song = { id: "song", versionId: "official", versionStatus: "published", publishedVersionIds: publishedIds };
    const submissions = [{ id: "own-pending", songId: "song", status: "pending" }];
    const savedEntry: SongbookEntryApi = {
      songId: "song", pinnedVersionId: "earlier", keyIndex: null, capo: null,
      song: { id: "song", versionId: "earlier", versionStatus: "archived", title: "Song", artist: "Artist", chordpro: "Lyrics", externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    };
    const ids = (versions: Awaited<ReturnType<typeof retrieveVersionSummaries>>) => versions!.map((version) => version.id).sort();
    expect([...selectableVersionIds({ song })].sort()).toEqual(ids(await retrieveVersionSummaries(db, "song")));
    expect([...selectableVersionIds({ song, submissions })].sort()).toEqual(ids(await retrieveVersionSummaries(db, "song", "viewer")));
    const archived = { ...song, versionId: "earlier", versionStatus: "archived" };
    expect([...selectableVersionIds({ song: archived })].sort()).toEqual(ids(await retrieveVersionSummaries(db, "song", undefined, "earlier")));
    sqlite.exec("INSERT INTO favorites(user_id, song_id, pinned_version_id) VALUES ('viewer', 'song', 'earlier')");
    expect([...selectableVersionIds({ song, savedEntry, submissions })].sort()).toEqual(ids(await retrieveVersionSummaries(db, "song", "viewer")));
    // Archiving, deleting, or merging a published alternative changes the actual
    // catalog IDs rather than leaving a UI estimate to be corrected on open.
    sqlite.exec("INSERT INTO song_version(id, song_id, status, user_id, created_at) VALUES ('alternative', 'song', 'published', 'other', 100)");
    for (const status of ["published", "archived", "deleted"]) {
      sqlite.prepare("UPDATE song_version SET status = ? WHERE id = 'alternative'").run(status);
      const publishedVersionIdsForSong = (await publishedVersionIds(db, ["song"])).get("song")!;
      expect([...selectableVersionIds({ song: { ...song, publishedVersionIds: publishedVersionIdsForSong } })].sort())
        .toEqual(ids(await retrieveVersionSummaries(db, "song")));
    }
  });

  it("lists approved history only for anonymous viewers and stays within the song", async () => {
    const versions = await retrieveVersionSummaries(db, "song");
    expect(versions?.map((v) => v.id)).toEqual(["official"]);
    expect(versions?.[0]).toMatchObject({
      isCurrent: true,
      key: "D",
      capo: 2,
      author: { id: "other", name: "Anna" },
    });
    expect((await retrieveVersionSummaries(db, "song", undefined, "earlier"))?.map((v) => v.id)).toEqual(["official", "earlier"]);
  });

  it("adds the viewer's pending edits without listing another author's drafts", async () => {
    const versions = await retrieveVersionSummaries(db, "song", "viewer");
    expect(versions?.map((v) => v.id)).toEqual(["own-pending", "official"]);
    expect(versions?.[0].author.name).toBe("Viewer");
  });

  it("does not list versions for missing or deleted songs", async () => {
    expect(await retrieveVersionSummaries(db, "missing")).toBeNull();
    expect(await retrieveVersionSummaries(db, "removed", "viewer")).toBeNull();
  });
});
