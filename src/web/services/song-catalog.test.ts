import { afterEach, expect, it, vi } from "vitest";
import { queryClient } from "src/lib/query-client";
import { fetchSongs } from "./song-service";
import type { SongDataApi } from "src/worker/api/api-types";

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

it("upgrades the catalog format through one normal sync request, then resumes incremental sync", async () => {
  const song: SongDataApi = {
    id: "song", versionId: "official", title: "Song", artist: "Artist", chordpro: "Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  queryClient.setQueryData(["songs"], [song]);
  queryClient.setQueryData(["songs-meta"], { version: "v1", lastUpdate: "2026-01-01", appVersion: __APP_VERSION__ });
  const updated = { ...song, publishedVersionIds: ["official"] };
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ status: "success", data: {
    songs: [updated], songDBVersion: "v1", lastUpdateAt: "2026-01-02", isIncremental: false,
  } })));
  vi.stubGlobal("fetch", fetch);
  const songs = await fetchSongs();
  expect(songs).toEqual([updated]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).not.toContain("incremental");
  queryClient.setQueryData(["songs"], songs);
  await fetchSongs();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(fetch.mock.calls[1]?.[0])).toContain("incremental");
});
