// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SongData } from "~/types/songData";
import { songVersionsQueryOptions } from "~/services/song-service";
import { SongVersionBadge } from "./SongVersionBadge";
import type { SongDataApi, SongVersionSummaryApi } from "src/worker/api/api-types";
import type { UserData } from "~/hooks/use-user-data";
import type { VersionSelection } from "src/lib/song-selection";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(), useRouter: () => ({ invalidate: vi.fn() }),
  Link: () => null,
}));
vi.mock("~/hooks/use-is-online", () => ({ useIsOnline: () => true }));

let root: Root;
let container: HTMLDivElement;
let cache: QueryClient;
const officialApi: SongDataApi = {
  id: "song", versionId: "official", title: "Song", artist: "Artist", chordpro: "Lyrics",
  createdAt: "2026-01-01", updatedAt: "2026-01-01", externalSource: null,
  versionStatus: "published", publishedVersionIds: ["official"],
};
const official = new SongData(officialApi);
const summary = (id: string): SongVersionSummaryApi => ({
  id, status: "published", key: null, capo: null, createdAt: "2026-01-01",
  author: { id: "owner", name: "Anna" }, isCurrent: id === "official",
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  container.remove();
  vi.unstubAllGlobals();
});

async function render(songData = official, userData?: UserData, selection?: VersionSelection) {
  await act(async () => root.render(
    <QueryClientProvider client={cache}><SongVersionBadge songData={songData} userData={userData} selection={selection} /></QueryClientProvider>,
  ));
  return container.querySelector('button[aria-label^="Version details:"]');
}

it("updates choices from the existing catalog without making a server request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await render()).toBeNull();
  await act(async () => {
    cache.setQueryData(["songs"], [{ ...officialApi, publishedVersionIds: ["official", "alternative"] }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector("button")).not.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

const viewer = { profile: { id: "viewer" }, submissions: [] } as unknown as NonNullable<UserData>;

it("keeps details visible for a saved version that is also the only official choice", async () => {
  cache.setQueryDefaults(["favorites"], { staleTime: Infinity });
  cache.setQueryData(["favorites", "viewer"], [{ songId: "song", pinnedVersionId: "official", keyIndex: null, capo: null }]);
  expect(await render(official, viewer)).not.toBeNull();
});

it("offers the different official version while retaining the saved archived choice", async () => {
  cache.setQueryDefaults(["favorites"], { staleTime: Infinity });
  cache.setQueryData(["favorites", "viewer"], [{ songId: "song", pinnedVersionId: "old", keyIndex: null, capo: null }]);
  const saved = new SongData({ ...officialApi, versionId: "old", versionStatus: "archived", isOfficial: false });
  expect((await render(saved, viewer))?.textContent).toContain("Official version available");
});

it("explains an unavailable saved version even with only one selectable sheet", async () => {
  expect(await render(official, undefined, { source: "saved", unavailable: true })).not.toBeNull();
});

it("doesn't reuse a book's alternatives after returning to the official context", async () => {
  const bookSong = new SongData({ ...officialApi, versionId: "imported", versionStatus: "archived", customVersionAuthor: { id: "owner", name: "Anna" } });
  cache.setQueryData(songVersionsQueryOptions("song", undefined, "imported").queryKey, [summary("official"), { ...summary("imported"), status: "archived" }]);
  cache.setQueryData(songVersionsQueryOptions("song", undefined, "official").queryKey, [summary("official")]);
  expect(await render(bookSong)).not.toBeNull();
  expect(await render()).toBeNull();
});
