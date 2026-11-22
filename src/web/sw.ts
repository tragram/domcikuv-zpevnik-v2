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

clientsClaim();

// A waiting worker activates naturally after all tabs close. For an explicit
// restart, check the tabs here so every caller sees the same set of clients.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "RESTART_FOR_UPDATE") return;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const otherTabs = tabs.some((tab) => tab.url.startsWith(self.registration.scope)
      && tab.id !== (event.source as Client | null)?.id);
    if (otherTabs) {
      event.ports[0]?.postMessage("other-tabs");
      return;
    }
    await self.skipWaiting();
  })());
});

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
  // R2 object paths have one more directory than static asset paths.
  ({ url }) => /^\/songs\/(?:[\w-][\w.-]*\/){2,3}full\/[\w-][\w.-]*\.webp$/.test(url.pathname),
  new CacheFirst({
    cacheName: CACHE_NAMES.ILLUSTRATIONS,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(CACHE_LIMITS.IMAGES),
    ],
  }),
);

// 3. FlagCDN SVGs - CacheFirst (flagcdn.com sends no CORS headers, so these
// are opaque responses fetched at runtime rather than precached via addAll)
registerRoute(
  ({ url }) => url.origin === "https://flagcdn.com",
  new CacheFirst({
    cacheName: CACHE_NAMES.FLAGS,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(CACHE_LIMITS.IMAGES),
    ],
  }),
);

// Keep thumbnails available after viewing them, including legacy CDN URLs.
registerRoute(
  ({ url }) => url.origin === self.location.origin && (
    url.pathname.startsWith("/cdn-cgi/image/width=128/") ||
    (url.pathname.startsWith("/songs/") && url.pathname.includes("/thumbnail/"))
  ),
  new CacheFirst({
    cacheName: CACHE_NAMES.THUMBNAILS,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin(CACHE_LIMITS.IMAGES)],
  }),
);

// TanStack Query persists the catalog in IndexedDB.
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());
