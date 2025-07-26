import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/songs";
import { RouterContext } from "~/main";
import { fetchProfile } from "~/services/users";
import { UserProfileData } from "src/worker/api/userProfile";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: () => <div>Not Found</div>,
  errorComponent: () => <div>Error</div>,
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

    const songDB = buildSongDB(songs, publicSongbooks);

    return {
      user: user as UserProfileData,
      songDB,
    };
  },
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TanStackRouterDevtools position="bottom-right" />
      <Toaster />
    </>
  ),
});
