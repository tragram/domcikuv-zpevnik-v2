// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SongData } from "~/types/songData";
import { useToggleFavorite } from "./FavoriteButton";

vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: () => true, useIsOnline: () => true }));

it.each([true, false])("the heart pins the displayed ID when official=%s", async (isOfficial) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  cache.setQueryData(["favorites", "viewer"], []);
  const song = new SongData({ id: "song", versionId: "displayed", title: "Song", artist: "Artist", chordpro: "Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", isOfficial });
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => new Response(JSON.stringify({ status: "success",
    data: init?.method === "POST" ? {} : [{ songId: "song", pinnedVersionId: "displayed", keyIndex: null, capo: null }],
  })));
  vi.stubGlobal("fetch", fetch);
  function Harness() {
    const favorite = useToggleFavorite(song, "viewer");
    return <button onClick={favorite.toggle}>{favorite.isFavorite ? "Saved" : "Save"}</button>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Harness /></QueryClientProvider>));
    await act(async () => { container.querySelector("button")!.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    const post = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ songId: "song", pinnedVersionId: "displayed" });
    expect(cache.getQueryData(["favorites", "viewer"])).toEqual([{ songId: "song", pinnedVersionId: "displayed", keyIndex: null, capo: null }]);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    vi.unstubAllGlobals();
  }
});
