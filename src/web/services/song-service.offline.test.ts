import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SongDataApi } from "src/worker/api/api-types";
import { findOrFetchSong, getCachedSongVersion, singleSongQueryOptions, songVersionsQueryOptions } from "./song-service";
import { ApiException } from "./api-service";
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
  it("does not reuse a sheet after the server has confirmed it is unavailable", async () => {
    const cache = new QueryClient();
    const options = singleSongQueryOptions("song", "revision");
    cache.setQueryData(options.queryKey, song);
    await cache.fetchQuery({ ...options, staleTime: 0, retry: false,
      queryFn: async () => { throw new ApiException("Version removed", 404); },
    }).catch(() => {});
    expect(getCachedSongVersion(cache, "song", "revision", [song])).toBeUndefined();
    cache.clear();
  });
  it("refreshes an exact catalog version online before returning its sheet", async () => {
    vi.mocked(getIsOnline).mockReturnValue(true);
    const cache = new QueryClient();
    cache.setQueryData(["songs"], [{ ...song, publishedVersionIds: ["revision", "retired"] }], { updatedAt: 1234 });
    const fresh = { ...song, chordpro: "Updated sheet", versionRevision: 2, publishedVersionIds: ["revision", "alternative"] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: fresh })));
    vi.stubGlobal("fetch", fetch);
    expect(await findOrFetchSong([], "song", "revision", cache)).toMatchObject({ chordpro: fresh.chordpro, versionRevision: 2 });
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.getQueryData<SongDataApi[]>(["songs"])?.[0].publishedVersionIds).toEqual(fresh.publishedVersionIds);
    expect(cache.getQueryState(["songs"])?.dataUpdatedAt).toBe(1234);
    cache.clear();
  });

  it("waits for online freshness even when the exact sheet is cached for an hour", async () => {
    vi.mocked(getIsOnline).mockReturnValue(true);
    const cache = new QueryClient({ defaultOptions: { queries: { staleTime: 3_600_000 } } });
    cache.setQueryData(singleSongQueryOptions("song", "revision").queryKey, song);
    let respond!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
    let resolved = false;
    const loading = findOrFetchSong([], "song", "revision", cache).then((result) => {
      resolved = true;
      return result;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    respond(new Response(JSON.stringify({ status: "success", data: { ...song, versionRevision: 2 } })));
    expect((await loading).versionRevision).toBe(2);
    cache.clear();
  });

  it("resolves the current official version online instead of a stale catalog default", async () => {
    vi.mocked(getIsOnline).mockReturnValue(true);
    const cache = new QueryClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success", data: { ...song, versionId: "new-official" },
    }))));
    expect((await findOrFetchSong([song], "song", undefined, cache)).versionId).toBe("new-official");
    cache.clear();
  });

  it("does not fall back to a cached sheet when online revalidation confirms deletion", async () => {
    vi.mocked(getIsOnline).mockReturnValue(true);
    const cache = new QueryClient();
    cache.setQueryData(singleSongQueryOptions("song", "revision").queryKey, song);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "fail", failData: { message: "Version removed" },
    }), { status: 404 })));
    await expect(findOrFetchSong([song], "song", "revision", cache)).rejects.toMatchObject({ status: 404 });
    cache.clear();
  });
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
