import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { queryClient } from "../lib/query-client";
import client, { API } from "../worker/api-client";
import { ThemeProvider } from "./components/ThemeProvider";
import "./main.css";
import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
  api: API;
}

// A deploy replaces the hashed chunk files while an already-open page still
// references the old names (the service worker's autoUpdate also cleans the old
// precache), so the next lazy route load fails with "Failed to fetch dynamically
// imported module". A plain reload picks up the new build — do it automatically
// instead of showing the error page. Rate-limited via sessionStorage so a
// genuinely broken build degrades to the error page instead of a reload loop.
const CHUNK_RELOAD_KEY = "app:lastChunkErrorReload";
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0");
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
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
  scrollRestoration: false,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// The persisted (offline) cache is restored at module load in query-client.ts; the
// root route awaits `cacheRestored` before its loaders run. Rendering itself is NOT
// gated on the restore, so the app shell always paints immediately.
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <Toaster />
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
