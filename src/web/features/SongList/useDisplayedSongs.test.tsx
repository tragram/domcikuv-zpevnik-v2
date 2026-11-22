// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { SongData } from "~/types/songData";
import { buildSongDB } from "~/services/song-service";
import type { SongDataApi } from "src/worker/api/api-types";
import { useDisplayedSongs } from "./useDisplayedSongs";

vi.mock("src/lib/auth/client", () => ({ authClient: { getSession: vi.fn() } }));
vi.mock("~/features/SongView/hooks/filterSettingsStore", () => ({ useFilterSettingsStore: () => ({ selectedSongbookId: "owner" }) }));
vi.mock("./searchStore", () => ({ useQueryStore: (select: (state: { query: string }) => string) => select({ query: "" }) }));
vi.mock("./Toolbar/SortMenu", () => ({ useSortSettingsStore: () => ({}) }));
vi.mock("./Toolbar/filters/songFilters", () => ({ applyFilters: (songs: SongData[]) => songs, sortSongs: (songs: SongData[]) => songs }));

it("uses the raw official sheet in another owner's book, before and after entries load", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetch);
  const cache = new QueryClient();
  const official: SongDataApi = {
    id: "song", versionId: "official", title: "Official sheet", artist: "Artist", chordpro: "Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", publishedVersionIds: ["official"],
  };
  cache.setQueryData(["songs"], [official]);
  const db = buildSongDB([{ ...official, title: "Viewer's pin", versionId: "mine" }], [], null);
  function List() {
    const { songs } = useDisplayedSongs(db, null);
    return <div>{songs.map((song) => song.title).join(", ")}</div>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={cache}><List /></QueryClientProvider>));
    expect(container.textContent).toBe("Official sheet");
    await act(async () => {
      cache.setQueryData(["songbookEntries", "owner"], [{ songId: "song", pinnedVersionId: null }]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe("Official sheet");
    // Only the existing owner-entry request runs; the catalog observer is local.
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    vi.unstubAllGlobals();
  }
});
