import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SongDataApi } from "src/worker/api/api-types";
import { findOrFetchSong, singleSongQueryOptions, songVersionsQueryOptions } from "./song-service";
import { getIsOnline } from "~/hooks/use-is-online";

vi.mock("~/hooks/use-is-online", () => ({
  getIsOnline: vi.fn(() => false),
  useIsOnline: () => false,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getIsOnline).mockReturnValue(false);
});

const song: SongDataApi = {
  id: "song", versionId: "revision", title: "Song", artist: "Artist",
  chordpro: "[C]Lyrics", externalSource: null,
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

describe("offline version access", () => {
  it("does not mask an online failure with stale history", async () => {
    vi.mocked(getIsOnline).mockReturnValue(true);
    const cache = new QueryClient();
    const options = songVersionsQueryOptions("song");
    cache.setQueryData(options.queryKey, []);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Server unavailable")));
    await expect(cache.fetchQuery({ ...options, staleTime: 0, retry: false }))
      .rejects.toThrow("Server unavailable");
  });

  it("finds the canonical offline sheet even when the local list contains a personal pin", async () => {
    const cache = new QueryClient();
    cache.setQueryData(["songs"], [song]);
    const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
    vi.stubGlobal("fetch", fetch);
    const result = await findOrFetchSong([{ ...song, versionId: "personal" }], "song", "revision", cache);
    expect(result.versionId).toBe("revision");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains successful history when its refresh fails", async () => {
    const cache = new QueryClient();
    const options = songVersionsQueryOptions("song");
    cache.setQueryData(options.queryKey, []);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    expect(await cache.fetchQuery({ ...options, staleTime: 0, retry: false })).toEqual([]);
    expect(cache.getQueryState(options.queryKey)?.status).toBe("success");
  });

  it("opens a previously downloaded revision without fetching it again", async () => {
    const cache = new QueryClient();
    cache.setQueryData(singleSongQueryOptions("song", "revision").queryKey, song);
    const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
    vi.stubGlobal("fetch", fetch);
    expect((await findOrFetchSong([], "song", "revision", cache)).versionId).toBe("revision");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens the downloaded canonical sheet through an exact-version link", async () => {
    const cache = new QueryClient();
    const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
    vi.stubGlobal("fetch", fetch);
    expect((await findOrFetchSong([song], "song", "revision", cache)).versionId).toBe("revision");
    expect(fetch).not.toHaveBeenCalled();
  });
});
