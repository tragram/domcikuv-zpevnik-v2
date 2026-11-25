// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { SongData } from "~/types/songData";
import { FavoriteButton, useToggleFavorite } from "./FavoriteButton";

vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: () => true, useIsOnline: () => true }));

it.each([
  { pinnedVersionId: "displayed", filled: true, action: undefined },
  { pinnedVersionId: "other", filled: false, action: "view" },
  { pinnedVersionId: "other", filled: false, action: "save" },
  { pinnedVersionId: undefined, filled: false, action: undefined },
])("handles the song header heart for saved version $pinnedVersionId and action $action", async ({ pinnedVersionId, filled, action }) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  cache.setQueryData(["favorites", "viewer"], pinnedVersionId ? [{ songId: "song", pinnedVersionId, keyIndex: null, capo: null }] : []);
  const song = new SongData({ id: "song", versionId: "displayed", title: "Song", artist: "Artist", chordpro: "Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const rootRoute = createRootRoute({
    component: () => <FavoriteButton song={song} userId="viewer" showSavedVersionPrompt />,
  });
  const songRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/song/$songId",
    validateSearch: (search: Record<string, unknown>) => ({ version: typeof search.version === "string" ? search.version : undefined }),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([songRoute]),
    history: createMemoryHistory({ initialEntries: ["/song/song?version=displayed"] }),
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      await router.load();
      root.render(<QueryClientProvider client={cache}><RouterProvider router={router} /></QueryClientProvider>);
    });
    expect(!!container.querySelector("svg.lucide-heart.fill-current")).toBe(filled);
    expect(!!container.querySelector("button svg.lucide-asterisk")).toBe(!!action);
    if (action) {
      const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
      await act(async () => trigger.click());
      expect(router.state.location.search).toEqual({ version: "displayed" });
      const prompt = document.querySelector('[role="dialog"][aria-label="Saved songbook version"]');
      expect(prompt?.textContent).toContain("Your songbook has a different version of this song.");
      const link = prompt!.querySelector<HTMLAnchorElement>("a")!;
      const saveButton = prompt!.querySelector<HTMLButtonElement>("button")!;
      expect(link.getAttribute("href")).toBe("/song/song?version=other");
      expect(saveButton.textContent).toBe("Save this version");

      if (action === "view") {
        await act(async () => link.click());
        expect(router.state.location.search).toEqual({ version: "other" });
        expect(cache.getQueryData(["favorites", "viewer"])).toEqual([{ songId: "song", pinnedVersionId, keyIndex: null, capo: null }]);
      } else {
        const entry = { songId: "song", pinnedVersionId: "displayed", keyIndex: null, capo: null };
        const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => new Response(JSON.stringify({
          status: "success", data: init?.method === "PATCH" ? null : [entry],
        })));
        vi.stubGlobal("fetch", fetch);
        await act(async () => {
          saveButton.click();
          await vi.waitFor(() => expect(router.state.location.href).toBe("/song/song"));
        });
        const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
        expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ pinnedVersionId: "displayed" });
        expect(cache.getQueryData(["favorites", "viewer"])).toEqual([entry]);
        expect(container.querySelector("svg.lucide-heart.fill-current")).not.toBeNull();
      }
      expect(document.querySelector('[aria-label="Saved songbook version"]')).toBeNull();
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
    cache.clear();
    vi.unstubAllGlobals();
  }
});

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

it("restores the cached favorite when the server rejects removal", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 60_000 } } });
  const entry = { songId: "song", pinnedVersionId: "displayed", keyIndex: null, capo: null };
  cache.setQueryData(["favorites", "viewer"], [entry]);
  const song = new SongData({ id: "song", versionId: "displayed", title: "Song", artist: "Artist", chordpro: "Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
    status: "fail", failData: { message: "Sign in again" },
  }, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  function Harness() {
    const favorite = useToggleFavorite(song, "viewer");
    return <button onClick={favorite.toggle}>{favorite.isFavorite ? "Saved" : "Save"}</button>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><Harness /></QueryClientProvider>));
    await act(async () => {
      container.querySelector("button")!.click();
      await vi.waitFor(() => expect(cache.getMutationCache().getAll()[0]?.state.status).toBe("error"));
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.getQueryData(["favorites", "viewer"])).toEqual([entry]);
    expect(container.textContent).toBe("Saved");
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    vi.unstubAllGlobals();
  }
});
