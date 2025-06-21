import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import { fetchSongDB } from "~/lib/songs";
import { RouterContext } from "~/main";

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: () => <div>Not Found</div>,
  errorComponent: () => <div>Error</div>,
  beforeLoad: async ({ context }) => {
    let userData;
    const userProfile = await context.queryClient.fetchQuery({
      queryKey: ["userProfile"],
      queryFn: async () => (await context.api.profile.$get()).json(),
    });
    if (userProfile) {
      console.log(userProfile)
      const favoritesData = await context.queryClient.fetchQuery({
        queryKey: ["favorites", userProfile.id],
        queryFn: async () => (await context.api.favorites.$get()).json(),
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

    return {
      userData,
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
