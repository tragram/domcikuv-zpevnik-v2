import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import copy from "rollup-plugin-copy";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa'

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
    // TODO: it appears to work but somehow takes up 120 MB in cache which is an order of magnitude more than expected
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        disableDevLogs: true,
        globDirectory: "dist/client",
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,yaml,json}",
          "songs/illustrations_thumbnails/**/*.webp",
          "songs/chordpro/**/*.pro",
          "songs/image_prompts/**/*.yaml",
          "songDB.{json,hash}",
          "site.webmanifest"
        ],
        navigateFallback: "/index.html",
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
          {
            urlPattern: ({ url }) => !url.pathname.startsWith("./"),
            handler: "NetworkFirst",
            options: {
              cacheName: "external-content",
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  preview: {
    port: 5173,
  },
});
