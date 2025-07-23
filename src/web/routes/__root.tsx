import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import { fetchSongDB, fetchSongDBAdmin } from "~/services/songs";
import { RouterContext } from "~/main";
import { Songbook } from "~/types/types";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: () => <div>Not Found</div>,
  errorComponent: () => <div>Error</div>,
  beforeLoad: async ({ context }) => {
    let userData;
    const userProfile = await context.queryClient.fetchQuery({
      queryKey: ["userProfile"],
      queryFn: async () => (await context.api.profile.$get()).json(),
      staleTime: Infinity,
    });
    if (userProfile) {
      const favoritesData = await context.queryClient.fetchQuery({
        queryKey: ["favorites", userProfile.id],
        queryFn: async () => (await context.api.favorites.$get()).json(),
        staleTime: 1000 * 60 * 5, // five minutes should be enough in case there are multiple sessions in parallel
      });
      userData = {
        ...userProfile,
        favorites: new Set(favoritesData),
        loggedIn: true,
      };
    } else {
      userData = {
        loggedIn: false,
        favorites: new Set([]),
      };
    }

    const songDB = await context.queryClient.fetchQuery({
      queryKey: ["songDB"],
      queryFn: fetchSongDB,
    });
    let publicSongbooks;
    try {
      publicSongbooks = await context.queryClient.fetchQuery({
        queryKey: ["publicSongbooks"],
        queryFn: async () =>
          (await context.api.favorites.publicSongbooks.$get()).json(),
        staleTime: 1000 * 60 * 60, // one hour
      });
      publicSongbooks.map((s) => {
        return { ...s, songIds: new Set(s.songIds) };
      });
    } catch (error) {
      console.error(error);
      publicSongbooks = [];
    }

    return {
      userData,
      songDB,
      availableSongbooks: new Set(publicSongbooks) as Set<Songbook>,
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
