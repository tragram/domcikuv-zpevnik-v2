// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { dehydrate, hydrate, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { AdminApi } from "src/worker/api-client";
import { useRestoreVersion } from "./admin-hooks";
import { refreshSongVersions } from "./version-service";
import { versionRefreshKeys } from "./song-query-keys";

vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: () => true, useIsOnline: () => true }));

it("refreshes public sheets, choices and songbooks after admin restoration", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const cache = new QueryClient();
  cache.setQueryData(["session"], { user: { id: "viewer" } });
  const refreshes = new Map<string, ReturnType<typeof vi.fn>>();
  for (const queryKey of versionRefreshKeys("song")) {
    const [key] = queryKey;
    const refresh = vi.fn(async () => []);
    refreshes.set(key, refresh);
    cache.setQueryDefaults(queryKey, { queryFn: refresh, staleTime: Infinity });
    const dataKey = key === "favorites" || key === "submissions" ? [key, "viewer"] : queryKey;
    cache.setQueryData(dataKey, key === "versionsAdmin" ? [{ id: "version", revision: 99 }] : []);
  }
  const post = vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { status: "published" } })));
  const api = { songs: { ":songId": { versions: { ":versionId": { ":action": { $post: post } } } } } } as unknown as AdminApi;
  let restore!: ReturnType<typeof useRestoreVersion>;
  function Harness() {
    const mutation = useRestoreVersion(api);
    useEffect(() => { restore = mutation; }, [mutation]);
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Harness /></QueryClientProvider>));
    await act(async () => { await restore.mutateAsync({ songId: "song", versionId: "version", expectedRevision: 2 }); });
    expect(post).toHaveBeenCalledWith({ param: { songId: "song", versionId: "version", action: "restore" }, json: { expectedRevision: 2 } });
    for (const key of versionRefreshKeys("song")) {
      expect(cache.getQueryState(key)?.isInvalidated || refreshes.get(key[0])?.mock.calls.length).toBeTruthy();
    }
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    vi.unstubAllGlobals();
  }
});

it("preserves a downloaded sheet across a refresh after hydration", async () => {
  const seed = new QueryClient();
  const cache = new QueryClient();
  const key = ["song", "fetch", "other", "alternative"];
  seed.setQueryData(key, { versionRevision: 2 });
  hydrate(cache, dehydrate(seed));
  const unrelatedFetch = vi.fn(async () => ({ versionRevision: 3 }));
  cache.setQueryDefaults(key, { queryFn: unrelatedFetch });
  await refreshSongVersions(cache, "song");
  expect(unrelatedFetch).not.toHaveBeenCalled();
  expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
  expect(dehydrate(cache).queries.map(q => q.queryKey)).toContainEqual(key);
  cache.clear();
  seed.clear();
});
