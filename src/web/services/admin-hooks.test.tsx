// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { AdminApi } from "src/worker/api-client";
import { useRestoreVersion } from "./admin-hooks";
import { versionRefreshKeys } from "./song-query-keys";

vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: () => true, useIsOnline: () => true }));

it("refreshes public sheets, choices and songbooks after admin restoration", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const cache = new QueryClient();
  const refreshes = new Map<string, ReturnType<typeof vi.fn>>();
  for (const [key] of versionRefreshKeys) {
    const refresh = vi.fn(async () => []);
    refreshes.set(key, refresh);
    cache.setQueryDefaults([key], { queryFn: refresh, staleTime: Infinity });
    cache.setQueryData([key], key === "versionsAdmin" ? [{ id: "version", revision: 99 }] : []);
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
    for (const refresh of refreshes.values()) expect(refresh).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    vi.unstubAllGlobals();
  }
});
