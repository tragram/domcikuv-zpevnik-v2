import type { Plugin } from "vite";

// An installed production worker otherwise keeps serving its cached HTML when
// this origin switches to Vite dev: /sw.js would become the SPA HTML fallback,
// which the browser rejects as a worker update. Preserve all user data/caches.
export const retirementWorker = `
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type: 'window' });
  await self.registration.unregister();
  await Promise.all(windows.map(client => client.navigate(client.url)));
})()));
`;

export function retireServiceWorker(): Plugin {
  return {
    name: "retire-production-worker-in-dev",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || req.url?.split("?")[0] !== "/sw.js") return next();
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Service-Worker-Allowed", "/");
        res.end(retirementWorker);
      });
    },
  };
}
