// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldRestoreSongScroll } from "./scroll-restoration";

const cleanups: (() => void)[] = [];
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
  await act(async () => cleanups.splice(0).forEach((cleanup) => cleanup()));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup(scrollRestoration: false | typeof shouldRestoreSongScroll) {
  const rootRoute = createRootRoute({ component: Outlet });
  const list = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <div>List</div> });
  const song = createRoute({ getParentRoute: () => rootRoute, path: "/song/$songId", component: () => <div>Song</div> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([list, song]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    scrollRestoration,
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanups.push(() => { root.unmount(); container.remove(); });
  await act(async () => {
    await router.load();
    root.render(<RouterProvider router={router} />);
  });
  return router;
}

describe("list-to-song scroll handling", () => {
  it("reproduces the missing reset with scroll restoration disabled", async () => {
    const router = await setup(false);
    const scroll = vi.spyOn(window, "scrollTo");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(4200);
    await act(async () => { await router.navigate({ to: "/song/$songId", params: { songId: "example" } }); });
    expect(scroll).not.toHaveBeenCalled();
  });

  it("lets the router start a newly opened song at the top", async () => {
    const router = await setup(shouldRestoreSongScroll);
    const scroll = vi.spyOn(window, "scrollTo");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(4200);
    await act(async () => { await router.navigate({ to: "/song/$songId", params: { songId: "example" } }); });
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 0, left: 0 }));
    scroll.mockClear();
    await act(async () => { await router.navigate({ to: "/" }); });
    expect(scroll).not.toHaveBeenCalled();
  });
});
