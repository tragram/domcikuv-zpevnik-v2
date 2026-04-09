import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { CustomError } from "~/components/CustomError";
import { NotFound } from "~/components/NotFound";
import { activeSessionsQueryOptions } from "~/hooks/use-active-sessions";
import {
  publicSongbooksQueryOptions,
  songsQueryOptions,
} from "~/hooks/use-songDB";
import { RouterContext } from "~/main";
import { sessionQueryOptions } from "../hooks/use-user-data";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: NotFound,
  errorComponent: CustomError,
  beforeLoad: async ({ context }) => {
    const songsPromise = context.queryClient.prefetchQuery(songsQueryOptions());
    context.queryClient.prefetchQuery(sessionQueryOptions());
    context.queryClient.prefetchQuery(publicSongbooksQueryOptions());
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
