// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  externalSearchResultSchema,
  type ExternalSearchResult,
} from "src/lib/contracts/external-search-schema";
import type { UserData } from "~/hooks/use-user-data";
import { fetchExternalSearch } from "~/services/song-service";
import { trackExternalSearchNavigation, useQueryStore } from "./searchStore";
import { useExternalSearch } from "./useExternalSearch";

vi.mock("~/hooks/use-is-online", () => ({
  getIsOnline: () => true,
  useIsOnline: () => true,
}));
vi.mock("~/services/song-service", () => ({ fetchExternalSearch: vi.fn() }));

const sources: ExternalSearchResult[] = [
  { id: "first", title: "Rain", artist: "Band", url: "https://first.test/rain", sourceId: "cifraclub" },
  { id: "second", title: "Rain", artist: "Band", url: "https://second.test/rain", sourceId: "pisnicky-akordy" },
];
const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(fetchExternalSearch).mockReset().mockResolvedValue(sources);
  const { setQuery } = useQueryStore.getState();
  setQuery("");
  setQuery("Rain");
});

afterEach(async () => {
  await act(async () => cleanups.splice(0).forEach((cleanup) => cleanup()));
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup({ searchOnline = true } = {}) {
  const importSource = vi.fn(async (_source: ExternalSearchResult) => {});
  const queryClient = new QueryClient();
  const rootRoute = createRootRoute({ component: Outlet });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: function List() {
      const query = useQueryStore((state) => state.query);
      const { hasTriggeredExternalSearch, externalSongs, triggerExternalSearch } =
        useExternalSearch({} as NonNullable<UserData>, importSource.mock.calls.length ? 0 : 1);
      return (
        <>
          <input aria-label="Search" value={query} readOnly />
          <button onClick={triggerExternalSearch}>Search Online Services</button>
          {hasTriggeredExternalSearch && externalSongs.map((song) => (
            <Link key={song.id} to="/import" search={sources.find((source) => source.id === song.id)!}>
              {song.id}
            </Link>
          ))}
        </>
      );
    },
  });
  const importRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/import",
    validateSearch: externalSearchResultSchema,
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
      await importSource(deps);
      throw redirect({
        to: "/song/$songId",
        params: { songId: "rain" },
        state: { externalImportPreview: true },
      });
    },
    errorComponent: () => <Link to="/" replace>Back to search</Link>,
  });
  const songRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/song/$songId",
    component: () => <Link to="/">Back to songbook</Link>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, importRoute, songRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const stopTracking = trackExternalSearchNavigation(router);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanups.push(() => { stopTracking(); root.unmount(); container.remove(); queryClient.clear(); });
  await act(async () => {
    await router.load();
    root.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  });

  function click(label: string) {
    const control = [...container.querySelectorAll<HTMLElement>("a, button")]
      .find((element) => element.textContent === label);
    expect(control).toBeDefined();
    return act(async () => { control?.click(); });
  }

  if (searchOnline) {
    await click("Search Online Services");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await vi.waitFor(() => expect(container.textContent).toContain("second"));
  }
  return { click, container, importSource, router };
}

it("returns to cached sources after a failed import and lets the user try another one", async () => {
  const { click, container, importSource, router } = await setup();
  importSource.mockRejectedValueOnce(new Error("Bad source"));
  await click("first");
  await click("Back to search");
  expect(container.querySelector("input")?.value).toBe("Rain");
  expect(container.textContent).toContain("second");
  expect(fetchExternalSearch).toHaveBeenCalledTimes(1);
  await click("second");
  expect(importSource).toHaveBeenLastCalledWith(sources[1]);
  expect(router.state.location.pathname).toBe("/song/rain");
});

it.each(["browser Back", "songbook link"])("restores sources via %s before the preview expires", async (wayBack) => {
  const { click, container, importSource, router } = await setup();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  await click("first");
  expect(router.state.location.pathname).toBe("/song/rain");
  clock.mockReturnValue(now + 59_999);

  if (wayBack === "browser Back") {
    await act(async () => { router.history.back(); });
  } else {
    await click("Back to songbook");
  }

  expect(container.querySelector("input")?.value).toBe("Rain");
  expect(container.textContent).toContain("second");
  expect(importSource).toHaveBeenCalledTimes(1);
  expect(fetchExternalSearch).toHaveBeenCalledTimes(1);
});

it.each(["timeout", "different song"])("returns to the unfiltered song list after %s", async (reason) => {
  const { click, container, router } = await setup();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  await click("first");
  if (reason === "timeout") {
    clock.mockReturnValue(now + 60_000);
  } else {
    await act(async () => { await router.navigate({ to: "/song/$songId", params: { songId: "other" } }); });
  }
  await click("Back to songbook");

  expect(container.querySelector("input")?.value).toBe("");
  expect(container.querySelector("a")).toBeNull();
  expect(fetchExternalSearch).toHaveBeenCalledTimes(1);
});

it("clears the previous search at 60 seconds while the list is still open", async () => {
  const { click, container } = await setup();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  await click("first");
  await act(async () => { vi.advanceTimersByTime(59_999); });
  await click("Back to songbook");
  expect(container.textContent).toContain("second");

  await act(async () => { vi.advanceTimersByTime(1); });
  expect(container.querySelector("input")?.value).toBe("");
  expect(container.querySelector("a")).toBeNull();
});

it("leaves a newer search intact when the previous search expires", async () => {
  const { click, container } = await setup();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  await click("first");
  await click("Back to songbook");
  await act(async () => { useQueryStore.getState().setQuery("Another song"); });
  await click("Search Online Services");
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

  expect(container.querySelector("input")?.value).toBe("Another song");
  expect(useQueryStore.getState().externalSearchTriggered).toBe(true);
});

it("keeps an ordinary local search when opening a song and returning", async () => {
  const { click, container, router } = await setup({ searchOnline: false });
  await act(async () => { await router.navigate({ to: "/song/$songId", params: { songId: "rain" } }); });
  await click("Back to songbook");

  expect(container.querySelector("input")?.value).toBe("Rain");
  expect(fetchExternalSearch).not.toHaveBeenCalled();
});

it("requires an explicit online search after editing the restored query", async () => {
  const { click, container } = await setup();
  await click("first");
  await click("Back to songbook");
  await act(async () => { useQueryStore.getState().setQuery("Rain again"); });

  expect(container.querySelector("a")).toBeNull();
  expect(fetchExternalSearch).toHaveBeenCalledTimes(1);
});
