/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";
import { SongDataApi } from "src/worker/api/api-types";

const CACHE_NAMES = {
  THUMBNAILS: "thumbnail-cache",
  ILLUSTRATIONS: "full-illustration-cache",
  FLAGS: "flagcdn-cache", 
};

const CACHE_LIMITS = {
  IMAGES: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 }, // 1 Year
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// 1. Navigation Fallback
let allowlist: undefined | RegExp[];
if (import.meta.env.DEV) allowlist = [/^\/$/];

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    allowlist,
    denylist: [/^\/api\//, /^\/songs\//],
  }),
);

// 2. Heavy Media - CacheFirst
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/songs/illustrations/") &&
    !url.pathname.includes("/thumbnail/"),
  new CacheFirst({
    cacheName: CACHE_NAMES.ILLUSTRATIONS,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(CACHE_LIMITS.IMAGES),
    ],
  }),
);

// 3. FlagCDN SVGs - CacheFirst
registerRoute(
  ({ url }) =>
    url.origin === "https://flagcdn.com" && url.pathname.endsWith(".svg"),
  new CacheFirst({
    cacheName: CACHE_NAMES.FLAGS,
    plugins: [
      // status 0 is required to cache cross-origin (opaque) responses if CORS isn't strictly set
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(CACHE_LIMITS.IMAGES),
    ],
  }),
);

// 4. API Routes - Network Only (Let TanStack Query handle the offline caching)
// We intercept /api/songs JUST to extract and cache the thumbnails in the background.
registerRoute(
  ({ url }) => url.pathname === "/api/songs",
  async ({ request }) => {
    const response = await fetch(request);
    // Clone response so we can return it to TanStack immediately while parsing JSON in background
    const clone = response.clone();

    clone
      .json()
      .then(async (unknownData: unknown) => {
        // Assert the type here instead of in the parameter
        const data = unknownData as { songs: SongDataApi[] };

        if (!data?.songs) return;
        const cache = await caches.open(CACHE_NAMES.THUMBNAILS);
        const urlsToCache = new Set<string>();

        for (const song of data.songs) {
          const thumbUrl = song.currentIllustration?.thumbnailURL;
          if (
            typeof thumbUrl === "string" &&
            thumbUrl.startsWith("/cdn-cgi/image/width=128/")
          ) {
            urlsToCache.add(thumbUrl);
          }
        }

        if (urlsToCache.size > 0) {
          console.debug("SW: Found URLs to cache:", urlsToCache);
          await cache
            .addAll(Array.from(urlsToCache))
            .catch((e) => console.warn("Thumb cache partial fail", e));
        }
      })
      .catch((err) =>
        console.error("PWA: Failed to parse songs for thumbnails", err),
      );

    return response;
  },
);

// All other API routes bypass the SW cache
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
