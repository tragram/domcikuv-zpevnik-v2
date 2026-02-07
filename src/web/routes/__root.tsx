import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { CustomError } from "~/components/CustomError";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/song-service";
import { RouterContext } from "~/main";
import { fetchProfile } from "~/services/user-service";
import { UserProfileData } from "src/worker/api/userProfile";
import { NotFound } from "~/components/NotFound";
import { prefetchActiveSessions } from "~/hooks/use-active-sessions";
import memoizeOne from "memoize-one";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: NotFound,
  errorComponent: CustomError,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ["userProfile"],
      queryFn: () => fetchProfile(context.api),
      staleTime: Infinity,
    });

    const songs = await context.queryClient.fetchQuery({
      queryKey: ["songs"],
      queryFn: () => fetchSongs(context.api),
      staleTime: 1000 * 60 * 60 * 24, // one day
    });

    const publicSongbooks = await context.queryClient.fetchQuery({
      queryKey: ["publicSongbooks"],
      queryFn: () => fetchPublicSongbooks(context.api),
      staleTime: 1000 * 60 * 60, // one hour
    });

    const activeSessions = await prefetchActiveSessions(
      context.queryClient,
      context.api
    );

    const memoizedBuildSongDB = memoizeOne(buildSongDB);

    const favoriteSongIds = user.loggedIn ? user.profile.favoriteSongIds : [];

    const songDB = memoizedBuildSongDB(songs, publicSongbooks, favoriteSongIds);

    return {
      user: user as UserProfileData,
      songDB,
      activeSessions,
    };
  },
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
});
