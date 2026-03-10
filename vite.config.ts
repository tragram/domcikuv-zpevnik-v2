import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import copy from "rollup-plugin-copy";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import checker from "vite-plugin-checker";

export default defineConfig(({ mode }) => {
  const isTest = process.env.VITEST !== undefined || mode === "test";
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
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
      checker({
        typescript: {
          tsconfigPath: "./tsconfig.json",
          buildMode: true,
        },
        enableBuild: process.env.CI ? false : true,
      }),
      !isTest && cloudflare(),
      tailwindcss(),
      !isTest &&
        copy({
          targets: [
            { src: "songs/*", dest: "dist/client/songs" },
            { src: "src/assets/*", dest: "dist/client/assets" },
          ],
          hook: "writeBundle",
        }),
      !isTest &&
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
              "songs/illustrations/*/*/thumbnail/*.webp",
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
    ].filter(Boolean),
    preview: {
      port: 5173,
    },
  };
});
