import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import copy from 'rollup-plugin-copy'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    tailwindcss(),
    copy({
      targets: [
        { src: 'songs/*', dest: 'dist/client/songs' },
        { src: 'src/assets/*', dest: 'dist/client/assets' },
      ],
      hook: 'writeBundle'
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      workbox: {
        globDirectory: 'dist/client',
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,yaml,json}',
          'songs/illustrations_thumbnails/**/*.webp',
          'songs/chordpro/**/*.pro',
          'songs/image_prompts/**/*.yaml',
          'songDB.{json,hash}'
        ],
        navigateFallback: '/index.html',
        // only cache the illlustrations when they are loaded fully
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              return url.pathname.startsWith('/songs/illustrations/');
            },
            handler: 'NetworkFirst' as const,
            options: {
              cacheName: 'full-illustration-cache',
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          },
          {
            urlPattern: ({ url }) => !url.pathname.startsWith("./"),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-content',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
      },
      manifest: {
        name: "Domčíkův zpěvník v2",
        id: "cz.hodandom.domcikuv-zpevnik-v2",
        short_name: "Zpěvník",
        description: "Druhá verze mého báječného zpěvníku - nyní offline!",
        icons: [
          {
            src: "assets/icons/favicon.svg",
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            sizes: "1024x1024",
            src: "assets/icons/maskable_icon.png",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "assets/icons/android-launchericon-144-144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "assets/icons/android-launchericon-192-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "assets/icons/android-launchericon-512-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "assets/icons/120.png",
            sizes: '120x120',
            type: 'image/png',
          },
          {
            src: "assets/icons/180.png",
            sizes: '180x180',
            type: 'image/png',
          },
          // {
          //   src: "assets/icons/favicon.ico",
          //   sizes: "128x128",
          //   type: "image/x-icon"
          // }
        ],
        screenshots: [
          {
            src: "assets/screenshots/songlist_wide.png",
            sizes: "2560x1600",
            type: "image/png",
            form_factor: "wide",
            label: "Song list"
          },
          {
            src: "assets/screenshots/songlist_iphone_xr.png",
            sizes: "828x1792",
            type: "image/png",
            form_factor: "narrow",
            label: "Song list"
          },
          {
            src: "assets/screenshots/songview_wide.png",
            sizes: "2560x1600",
            type: "image/png",
            form_factor: "wide",
            label: "Song view"
          },
          {
            src: "assets/screenshots/songview_iphone_xr.png",
            sizes: "828x1792",
            type: "image/png",
            form_factor: "narrow",
            label: "Song view"
          }
        ],
        theme_color: '#F28C28',
        background_color: '#fff2e5',
        display: "standalone",
        orientation: 'any',
      },
    })
  ],
  define: {
    'APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/app"),
    },
  },
});