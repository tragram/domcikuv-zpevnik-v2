import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Precache
precacheAndRoute(self.__WB_MANIFEST);

// Cleanup outdated caches
cleanupOutdatedCaches();

// Runtime caching

// Cache illustrations under /songs/illustrations/
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith('/songs/illustrations/');
  },
  new CacheFirst({
    cacheName: 'full-illustration-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// API cache with NetworkFirst
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith('/api/');
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Fallback for SPA routes
registerRoute(
  new NavigationRoute(async ({ request, url }) => {
    
    // Don't handle API routes
    if (url.pathname.startsWith('/api/')) {
      return null;
    }
    
    // Try to get index.html from cache, fallback to network
    try {
      const cachedResponse = await caches.match('/index.html') || await caches.match('index.html');
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, fetch from network
      return await fetch('/index.html');
    } catch (error) {
      console.error('[Service Worker] Failed to serve SPA fallback:', error);
      return new Response('App temporarily unavailable', { 
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  })
);