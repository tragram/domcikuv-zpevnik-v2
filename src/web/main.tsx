import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { queryClient } from "../lib/query-client";
import client, { API } from "../worker/api-client";
import { ThemeProvider } from "./components/ThemeProvider";
import { PWAInstaller } from "./components/PWAInstaller";
import { trackExternalSearchNavigation } from "./features/SongList/searchStore";
import "./main.css";
import { routeTree } from "./routeTree.gen";
import { shouldRestoreSongScroll } from "./lib/scroll-restoration";

import { assetLoadError } from "./lib/asset-load-error";
import { startAppUpdates } from "./services/app-updates";

if (import.meta.env.PROD) startAppUpdates();

export interface RouterContext {
  queryClient: QueryClient;
  api: API;
}

// Let the route error boundary offer recovery. TanStack Router recognizes the
// browser's raw module-fetch error by its message prefix and otherwise reloads
// the whole document, including when an editor is finishing a save.
window.addEventListener("vite:preloadError", ({ payload }) => {
  if (payload instanceof Error && assetLoadError.test(payload.message) && !payload.message.startsWith("Songbook asset: ")) {
    payload.message = "Songbook asset: " + payload.message;
  }
});

// Create the router
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    api: client.api,
  } as RouterContext,
  // defaultPreload: "intent",
  // defaultPreloadStaleTime: 0,
  scrollRestoration: shouldRestoreSongScroll,
});
trackExternalSearchNavigation(router);

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// The persisted (offline) cache is restored at module load in query-client.ts; the
// root route awaits `cacheRestored` before its loaders read the offline data.
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  // Fetch the song route's UI while the root route restores IndexedDB.
  const { foundRoute } = router.getMatchedRoutes(router.latestLocation.pathname);
  if (foundRoute?.id === "/song/$songId") {
    void router.loadRouteChunk(foundRoute);
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <Toaster />
          <PWAInstaller />
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
