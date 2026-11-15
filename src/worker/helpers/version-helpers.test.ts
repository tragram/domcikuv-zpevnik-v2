import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "src/lib/db/schema";
import type { AppDatabase } from "../api/utils";
import { retrieveVersionSummaries } from "./version-helpers";

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
  `);
  // Exercise the real relational queries against SQLite without a Worker runtime.
  db = drizzle(async (sql, params, method) => {
    const rows = sqlite.prepare(sql).all(...params).map(Object.values);
    return { rows: method === "get" ? rows[0]! : rows };
  }, { schema }) as unknown as AppDatabase;
});

afterEach(() => sqlite.close());

describe("song version summaries", () => {
  it("lists approved history only for anonymous viewers and stays within the song", async () => {
    const versions = await retrieveVersionSummaries(db, "song");
    expect(versions?.map((v) => v.id)).toEqual(["official", "earlier"]);
    expect(versions?.[0]).toMatchObject({
      isCurrent: true,
      key: "D",
      capo: 2,
      author: { id: "other", name: "Anna" },
    });
    expect(versions?.[1].isCurrent).toBe(false);
  });

  it("adds the viewer's pending edits without listing another author's drafts", async () => {
    const versions = await retrieveVersionSummaries(db, "song", "viewer");
    expect(versions?.map((v) => v.id)).toEqual(["own-pending", "official", "earlier"]);
    expect(versions?.[0].author.name).toBe("Viewer");
  });

  it("does not list versions for missing or deleted songs", async () => {
    expect(await retrieveVersionSummaries(db, "missing")).toBeNull();
    expect(await retrieveVersionSummaries(db, "removed", "viewer")).toBeNull();
  });
});
