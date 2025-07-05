import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim, skipWaiting } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

// Precache
precacheAndRoute(self.__WB_MANIFEST);

// Cleanup outdated caches
cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

// Fallback for SPA routes
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL("index.html"),
    {
      denylist: [/^\/api\//],
    }
  )
);

// Runtime caching
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith("/songs/illustrations/");
  },
  new CacheFirst({
    cacheName: "full-illustration-cache",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => {
    return url.pathname.startsWith("/api/");
  },
  new NetworkFirst({
    cacheName: "api-cache",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);
