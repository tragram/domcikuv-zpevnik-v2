import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import client from "../worker/api-client";
import { ThemeProvider } from "./components/ThemeProvider";
import "./main.css";
import { routeTree } from "./routeTree.gen";

// Create the query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      // staleTime: 1000 * 60 * 2, // 2 minutes
      networkMode: "offlineFirst",
    },
  },
});

export interface RouterContext {
  queryClient: QueryClient; // Replace with your actual QueryClient type
  api: typeof client.api; // Replace with your actual API client type
}

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
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
