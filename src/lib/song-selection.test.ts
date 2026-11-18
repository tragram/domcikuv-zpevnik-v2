import { describe, expect, it } from "vitest";
import type { SongbookEntryApi, SongDataApi } from "src/worker/api/api-types";
import { selectableVersionIds, selectSongVersion, songbookSheet } from "./song-selection";

const official: SongDataApi = {
  id: "song", versionId: "official", title: "Song", artist: "Artist",
  chordpro: "Lyrics", createdAt: "2026-01-01", updatedAt: "2026-01-01", externalSource: null,
};
const ownEntry: SongbookEntryApi = {
  songId: "song", pinnedVersionId: "mine", keyIndex: 3, capo: 1,
  song: { ...official, versionId: "mine" },
};
const bookEntry: SongbookEntryApi = {
  ...ownEntry, pinnedVersionId: "theirs", song: { ...official, versionId: "theirs" },
};

describe("version selection priority", () => {
  it("uses the same personal sheet for the song list and a normal open", () => {
    const selected = selectSongVersion({ official, ownEntry });
    expect(selected.sheet).toBe(songbookSheet(official, ownEntry));
    expect(selected.source).toBe("saved");
  });

  it("uses the selected book instead of the viewer's pin", () => {
    expect(selectSongVersion({ official, ownEntry, songbook: { entry: bookEntry, ownerName: "Anna" } }))
      .toMatchObject({ source: "songbook", sheet: bookEntry.song, ownerName: "Anna", personalizationOverride: { keyIndex: 3, capo: 1 } });
  });

  it("uses official when the selected book has no entry, without leaking the viewer's pin", () => {
    expect(selectSongVersion({ official, ownEntry, songbook: {} }))
      .toMatchObject({ source: "songbook", sheet: official });
  });

  it("returns to the personal version when leaving a book", () => {
    selectSongVersion({ official, ownEntry, songbook: { entry: bookEntry } });
    expect(selectSongVersion({ official, ownEntry }).sheet?.versionId).toBe("mine");
    expect(selectSongVersion({ official }).sheet?.versionId).toBe("official");
  });

  it("gives exact links priority and drops the book's key/capo", () => {
    const selected = selectSongVersion({ official, ownEntry, songbook: { entry: bookEntry }, versionId: "linked" });
    expect(selected.source).toBe("link");
    expect(selected.pinnedVersionId).toBeUndefined();
    expect(selected.personalizationOverride).toBeUndefined();
  });

  it("keeps the unavailable pin ID while falling back to official", () => {
    const entry = { ...ownEntry, song: undefined };
    expect(selectSongVersion({ official, ownEntry: entry }))
      .toMatchObject({ source: "saved", sheet: official, pinnedVersionId: "mine" });
  });

  it("can display a personal song absent from the official catalog", () => {
    expect(selectSongVersion({ ownEntry }).sheet).toBe(ownEntry.song);
  });

  it("keeps song-wide availability current when a saved sheet was downloaded earlier", () => {
    const updatedOfficial = { ...official, publishedVersionIds: ["official", "new"] };
    const oldPin = { ...ownEntry, song: { ...ownEntry.song!, publishedVersionIds: ["official", "old"] } };
    expect(songbookSheet(updatedOfficial, oldPin)).toMatchObject({ versionId: "mine", publishedVersionIds: ["official", "new"] });
  });
});

const song = { id: "song", versionId: "official", versionStatus: "published", publishedVersionIds: ["official"] };
describe("selectable version IDs", () => {
  it("uses the actual published IDs without downloading summaries", () => {
    expect([...selectableVersionIds({ song })]).toEqual(["official"]);
    expect(selectableVersionIds({ song: { ...song, publishedVersionIds: ["official", "other"] } }).size).toBe(2);
  });

  it("deduplicates saved, shown, and published versions", () => {
    const savedEntry = { ...ownEntry, song: { ...official, versionId: "official", versionStatus: "published" as const } };
    expect(selectableVersionIds({ song, savedEntry }).size).toBe(1);
    const archived = { ...song, versionId: "mine", versionStatus: "archived" };
    expect([...selectableVersionIds({ song: archived, savedEntry: { ...ownEntry, song: { ...ownEntry.song!, versionStatus: "archived" } } })]).toEqual(["official", "mine"]);
  });

  it("does not invent an alternative from an unavailable saved pin", () => {
    expect(selectableVersionIds({ song, savedEntry: { ...ownEntry, song: undefined } }).size).toBe(1);
    expect(selectableVersionIds({ song, savedEntry: { ...ownEntry, song: { ...ownEntry.song!, versionStatus: "deleted" } } }).size).toBe(1);
  });

  it("adds only own pending submissions for this song", () => {
    expect([...selectableVersionIds({ song, submissions: [
      { id: "pending", songId: "song", status: "pending" },
      { id: "pending", songId: "song", status: "pending" },
      { id: "unrelated", songId: "other", status: "pending" },
      { id: "closed", songId: "song", status: "rejected" },
    ] })]).toEqual(["official", "pending"]);
  });

  it("does not guess two choices for legacy offline data", () => {
    expect(selectableVersionIds({ song: { id: "song" } }).size).toBe(0);
  });
});
