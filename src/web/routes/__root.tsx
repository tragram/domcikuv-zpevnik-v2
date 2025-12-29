import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { CustomError } from "~/components/CustomError";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/songs";
import { RouterContext } from "~/main";
import { fetchActiveSessions, fetchProfile } from "~/services/users";
import { UserProfileData } from "src/worker/api/userProfile";
import { NotFound } from "~/components/NotFound";

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

    const activeSessions = await context.queryClient.fetchQuery({
      queryKey: ["activeSessions"],
      queryFn: () => fetchActiveSessions(context.api),
      staleTime: 1000 * 60 * 60 * 24, // one day default - refetched when the list is open
    });

    const songDB = buildSongDB(songs, publicSongbooks);
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
