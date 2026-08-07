import { describe, expect, it } from "vitest";

import {
  indexSongbookEntries,
  normalizeSongbookEntries,
} from "./use-user-data";

describe("songbook entry cache normalization", () => {
  it("upgrades legacy favorite ids to songbook entries", () => {
    expect(normalizeSongbookEntries(["song-1"])).toEqual([
      {
        songId: "song-1",
        pinnedVersionId: null,
        keyIndex: null,
        capo: null,
      },
    ]);
  });

  it("indexes legacy and current entries by song id", () => {
    const current = {
      songId: "song-2",
      pinnedVersionId: "version-2",
      keyIndex: 4,
      capo: 2,
    };

    const { favoriteIds, songbookEntries } = indexSongbookEntries([
      "song-1",
      current,
    ]);

    expect(favoriteIds).toEqual(new Set(["song-1", "song-2"]));
    expect(songbookEntries.get("song-1")).toMatchObject({ songId: "song-1" });
    expect(songbookEntries.get("song-2")).toBe(current);
  });
});
