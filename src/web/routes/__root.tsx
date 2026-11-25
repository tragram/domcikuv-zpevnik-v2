import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { cacheRestored } from "src/lib/query-client";
import { CustomError } from "~/components/CustomError";
import { NotFound } from "~/components/NotFound";
import { songsQueryOptions } from "~/hooks/use-songDB";
import { RouterContext } from "~/main";
import { sessionQueryOptions } from "../hooks/use-user-data";

let initialSessionCheckStarted = false;

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: NotFound,
  errorComponent: CustomError,
  beforeLoad: async ({ context }) => {
    // Ensure the persisted (offline) cache is hydrated before any loader reads it,
    // so a hard reload while offline doesn't race an empty cache (and then fail to
    // fetch). Resolves instantly after the first load; bounded by a timeout so it
    // can never hang the app.
    await cacheRestored;

    const songsPromise = context.queryClient.prefetchQuery(songsQueryOptions());
    // OAuth returns via a full page load and can leave a different cached user.
    if (!initialSessionCheckStarted) {
      initialSessionCheckStarted = true;
      void context.queryClient.prefetchQuery({ ...sessionQueryOptions(), staleTime: 0 });
    }

    // Local D1 can change between reloads. Wait for its catalog in dev so
    // loaders do not capture stale data restored from IndexedDB.
    const cachedSongs = context.queryClient.getQueryData(["songs"]);
    if (!cachedSongs || import.meta.env.DEV) {
      await songsPromise;
    }
  },
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
});
