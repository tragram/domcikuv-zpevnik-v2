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
      strategies: "injectManifest",
      srcDir: "src/web",
      filename: "sw.ts",
      manifest: false,
      injectManifest: {
        globDirectory: "dist/client/",
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,yaml,json}",
          // "songs/chordpro/*.pro",
          "songs/illustrations/**/*.webp",
          // "songs/image_prompts/**/*.yaml",
          "site.webmanifest",
        ],
      },
      devOptions: {
        enabled: false,
        type: "module",
        navigateFallback: "/",
      },
    }),
  ],
  preview: {
    port: 5173,
  },
});
