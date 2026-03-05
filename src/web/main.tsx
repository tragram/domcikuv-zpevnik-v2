import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { z } from "zod";
import type { FileRouteTypes } from "~/routeTree.gen";
import client, { API } from "../worker/api-client";
import { ThemeProvider } from "./components/ThemeProvider";
import "./main.css";
import { routeTree } from "./routeTree.gen";

// Create the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60, // 1 hour default
      networkMode: "offlineFirst",
    },
  },
});

export interface RouterContext {
  queryClient: QueryClient;
  api: API;
}
export const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine((val) => val.startsWith("/") && !val.startsWith("//")) // Security check
    .optional()
    .catch(undefined), // Strip out bad URLs seamlessly
});

// Create the router
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    api: client.api,
  } as RouterContext,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: false,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
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
