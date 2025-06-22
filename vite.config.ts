import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import copy from "rollup-plugin-copy";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/web/routes",
      generatedRouteTree: "src/web/routeTree.gen.ts",
    }),
    react(),
    cloudflare(),
    tailwindcss(),
    copy({
      targets: [
        { src: "songs/*", dest: "dist/client/songs" },
        { src: "src/assets/*", dest: "dist/client/assets" },
      ],
      hook: "writeBundle",
    }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        disableDevLogs: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],

        globDirectory: "dist/client/",
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,yaml,json}",
          "songs/chordpro/*.pro",
          "songs/illustrations_thumbnails/**/*.webp",
          "songs/image_prompts/**/*.yaml",
          "site.webmanifest",
          "songDB.json",
        ],
        // only cache the illlustrations when they are loaded fully
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              return url.pathname.startsWith("/songs/illustrations/");
            },
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "full-illustration-cache",
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache API responses for offline use
          {
            urlPattern: ({ url }) => {
              return url.pathname.startsWith("/api/");
            },
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "api-cache",
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          // TODO: it appears that this takes up ~100 MB in cache which is an order of magnitude more than expected
          //
          // {
          //   urlPattern: ({ url }) => {
          //     return (
          //       !url.pathname.startsWith("./") &&
          //       url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i)
          //     );
          //   },
          //   handler: "NetworkFirst",
          //   options: {
          //     cacheName: "external-images",
          //     cacheableResponse: {
          //       statuses: [0, 200],
          //     },
          //   },
          // },
        ],
      },
    }),
  ],
  preview: {
    port: 5173,
  },
});
