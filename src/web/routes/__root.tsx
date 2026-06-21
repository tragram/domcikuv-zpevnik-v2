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
import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { RouterContext } from "~/main";
import {
  sessionQueryOptions,
  songbookEntriesQueryOptions,
} from "../hooks/use-user-data";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: NotFound,
  errorComponent: CustomError,
  beforeLoad: async ({ context }) => {
    const songsPromise = context.queryClient.prefetchQuery(songsQueryOptions());
    context.queryClient.prefetchQuery(sessionQueryOptions());
    context.queryClient.prefetchQuery(publicSongbooksQueryOptions());
    context.queryClient.prefetchQuery(activeSessionsQueryOptions());

    // Warm (and persist for offline) the foreign songbook the user is currently
    // filtered to, so its contents — including the owner's pending songs that
    // aren't in the global DB — survive into the next offline launch, the same
    // way the songs DB above does. Skips the user's own songbook (served from
    // buildSongDB, not this query).
    const { selectedSongbookId } = useFilterSettingsStore.getState();
    if (selectedSongbookId) {
      const self = context.queryClient.getQueryData<{ user?: { id?: string } }>([
        "session",
      ])?.user?.id;
      if (selectedSongbookId !== self) {
        context.queryClient.prefetchQuery(
          songbookEntriesQueryOptions(selectedSongbookId),
        );
      }
    }

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
