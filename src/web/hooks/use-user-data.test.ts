import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import {
  favoritesQueryOptions,
  indexSongbookEntries,
  sessionQueryOptions,
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

  it("reuses a recent session and favorites across navigation", async () => {
    const cache = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 60_000 } } });
    const session = sessionQueryOptions();
    const favorites = favoritesQueryOptions("user-1");
    const fetchSession = vi.fn(async () => null);
    const fetchFavorites = vi.fn(async () => []);
    cache.setQueryData(session.queryKey, null);
    cache.setQueryData(favorites.queryKey, []);

    await cache.fetchQuery({ ...session, queryFn: fetchSession });
    await cache.fetchQuery({ ...favorites, queryFn: fetchFavorites });
    expect(fetchSession).not.toHaveBeenCalled();
    expect(fetchFavorites).not.toHaveBeenCalled();

    await cache.invalidateQueries({ queryKey: favorites.queryKey });
    await cache.fetchQuery({ ...favorites, queryFn: fetchFavorites });
    expect(fetchFavorites).toHaveBeenCalledOnce();
  });
});
