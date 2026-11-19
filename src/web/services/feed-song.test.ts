import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { API } from "src/worker/api-client";
import { feedSongQueryOptions } from "./feed-song";

it("refreshes an active follower query on a new revision and reuses it for transpose changes", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const sheet = (chordpro: string) => new Response(JSON.stringify({ status: "success", data: {
    id: "song", versionId: "version", versionRevision: chordpro === "Original sheet" ? 1 : 2, title: "Song", artist: "Artist", chordpro,
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  } }));
  const getSheet = vi.fn().mockResolvedValueOnce(sheet("Original sheet")).mockResolvedValueOnce(sheet("Corrected sheet"));
  const api = { songs: { fetch: { ":songId": { ":versionId": { $get: getSheet } } } } } as unknown as API;
  const state = { songId: "song", versionId: "version", versionRevision: 1, transposeSteps: 0 };
  const options = feedSongQueryOptions(api, state);
  const observer = new QueryObserver(cache, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await cache.fetchQuery(options);
    expect(observer.getCurrentResult().data?.chordpro).toBe("Original sheet");
    const revised = { ...state, versionRevision: 2 };
    const updated = feedSongQueryOptions(api, revised);
    observer.setOptions(updated);
    await cache.fetchQuery(updated);
    expect(observer.getCurrentResult().data?.chordpro).toBe("Corrected sheet");
    expect(getSheet).toHaveBeenCalledTimes(2);
    const transposed = { ...revised, transposeSteps: 3 };
    observer.setOptions(feedSongQueryOptions(api, transposed));
    expect(getSheet).toHaveBeenCalledTimes(2);
  } finally { unsubscribe(); cache.clear(); }
});

it("waits for the host when the live sheet has advanced", async () => {
  const getSheet = async () => Response.json({ status: "success", data: { versionRevision: 4 } });
  const api = { songs: { fetch: { ":songId": { ":versionId": { $get: getSheet } } } } } as unknown as API;
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = feedSongQueryOptions(api, { songId: "song", versionId: "version", versionRevision: 3 });
  await expect(cache.fetchQuery(options)).rejects.toThrow("Waiting for the host");
  expect(cache.getQueryData(options.queryKey)).toBeUndefined();
  cache.clear();
});
