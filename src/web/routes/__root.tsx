import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { cacheRestored } from "src/lib/query-client";
import { CustomError } from "~/components/CustomError";
import { NotFound } from "~/components/NotFound";
import { activeSessionsQueryOptions } from "~/hooks/use-active-sessions";
import {
  publicSongbooksQueryOptions,
  songsQueryOptions,
} from "~/hooks/use-songDB";
import { userProfileQueryOptions } from "~/hooks/use-user-profile";
import { RouterContext } from "~/main";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: NotFound,
  errorComponent: CustomError,
  beforeLoad: async ({ context }) => {
    await cacheRestored;

    const songsPromise = context.queryClient.prefetchQuery(songsQueryOptions());

    context.queryClient.prefetchQuery(publicSongbooksQueryOptions());
    context.queryClient.prefetchQuery(userProfileQueryOptions());
    context.queryClient.prefetchQuery(activeSessionsQueryOptions());

    // only block the route if the user has no songs cached
    const cachedSongs = context.queryClient.getQueryData(["songs"]);
    if (!cachedSongs) {
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
