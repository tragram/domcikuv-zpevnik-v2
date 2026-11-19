import { describe, expect, it } from "vitest";

import {
  favoritesQueryOptions,
  indexSongbookEntries,
} from "./use-user-data";

describe("structured songbook entries", () => {
  it("indexes an empty cache", () => {
    expect(indexSongbookEntries(undefined).favoriteIds.size).toBe(0);
  });

  it("indexes structured entries by song id", () => {
    const current = {
      songId: "song-2",
      pinnedVersionId: "version-2",
      keyIndex: 4,
      capo: 2,
    };

    const { favoriteIds, songbookEntries } = indexSongbookEntries([
      { songId: "song-1", pinnedVersionId: null, keyIndex: null, capo: null },
      current,
    ]);

    expect(favoriteIds).toEqual(new Set(["song-1", "song-2"]));
    expect(songbookEntries.get("song-1")).toMatchObject({ songId: "song-1" });
    expect(songbookEntries.get("song-2")).toBe(current);
  });

  it("always revalidates persisted favorites when the app mounts", () => {
    const options = favoritesQueryOptions("user-1", true);

    expect(options.staleTime).toBe(0);
    expect(options.refetchOnMount).toBe("always");
  });

  it("does not make each favorite button refetch on mount", () => {
    const options = favoritesQueryOptions("user-1");

    expect(options.refetchOnMount).toBeUndefined();
  });
});
