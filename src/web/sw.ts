/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches, getCacheKeyForURL, matchPrecache } from "workbox-precaching";
// injectManifest bundles this worker after Vite has emitted the client.
import appShell from "../../dist/client/index.html?raw";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cacheNames, clientsClaim } from "workbox-core";


const CACHE_NAMES = {
  THUMBNAILS: "thumbnail-cache",
  ILLUSTRATIONS: "full-illustration-cache",
  FLAGS: "flagcdn-cache",
};
const CACHE_LIMITS = {
  IMAGES: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 }, // 1 Year
};

cleanupOutdatedCaches();

clientsClaim();

// Current clients reload themselves, after any in-flight save. Older pages
// need the worker to navigate them once the new release takes control.
const tabsToReload = new Set<string>();
function supportsCoordinatedReload(tab: Client): Promise<boolean> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (supported: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(supported);
    };
    const timer = setTimeout(() => finish(false), 3000);
    channel.port1.onmessage = event => finish(event.data === "reload-on-update");
    try {
      tab.postMessage({ type: "CHECK_UPDATE_RELOAD" }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "RESTART_FOR_UPDATE") return;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const peers = tabs.filter(tab => tab.url.startsWith(self.registration.scope)
      && tab.id !== (event.source as Client | null)?.id);
    const supported = await Promise.all(peers.map(supportsCoordinatedReload));
    peers.forEach((tab, index) => {
      if (!supported[index]) tabsToReload.add(tab.id);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  if (!tabsToReload.size) return;
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window" });
    for (const tab of windows) {
      if (tabsToReload.has(tab.id)) {
        // Start the navigation during activation. The fetch can wait for
        // activation to finish, so don't await navigation inside this event.
        void tab.navigate(tab.url).catch(console.warn);
      }
    }
    tabsToReload.clear();
  })());
});

// The shell is small and belongs to this exact worker. Returning a fresh HTML
// Response also avoids replaying redirected or damaged cached navigations.
const entryScript = appShell.match(/<script\b[^>]*\bsrc="([^"]+)"/)?.[1];
const reconnectPage = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reopen the songbook</title><main><h1>Reconnect to open the songbook</h1>
<p>The app files on this device are incomplete. Reconnect and try again.</p>
<button onclick="location.reload()">Try again</button></main></html>`;
const htmlResponse = (html: string, status = 200) => new Response(html, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

let allowlist: undefined | RegExp[];
if (import.meta.env.DEV) allowlist = [/^\/$/];

registerRoute(
  new NavigationRoute(async ({ request }) => {
    const entry = entryScript && await matchPrecache(entryScript).catch(() => undefined);
    if (entry && entry.ok && /javascript/i.test(entry.headers.get("content-type") ?? "")) {
      return htmlResponse(appShell);
    }
    if (entry && entryScript) {
      // Otherwise a network-loaded document can request this same script and
      // immediately hit the bad cached response again.
      const key = getCacheKeyForURL(entryScript);
      if (key) await caches.open(cacheNames.precache).then(c => c.delete(key)).catch(() => {});
    }
    // The browser can evict Cache Storage independently of the worker. Load
    // the requested URL from the origin, which may already serve a newer build.
    try {
      return await fetch(request);
    } catch {
      return htmlResponse(reconnectPage, 503);
    }
  }, {
    allowlist,
    denylist: [/^\/(?:api|songs|assets|icons|screenshots)\//, /^\/site\.webmanifest(?:\?|$)/],
  }),
);
precacheAndRoute(self.__WB_MANIFEST);

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
