// vite.config.ts
import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import Unfonts from 'unplugin-fonts/vite'
import { VitePWA, VitePWAOptions } from "vite-plugin-pwa"

// const basePath = "/domcikuv-zpevnik-v2/";
const basePath = "./";

const pwaManifest: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  // devOptions: {
  //   enabled: true,
  //   navigateFallback: 'index.html',
  //   type: 'module'
  // },
  includeAssets: [
    "songs/illustrations_thumbnails/**/*.webp",
    "songs/chordpro/**/*.pro",
    "songs/image_prompts/**/*.yaml",
    'songDB.json',
    'songDB.hash'
  ],
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,pro,yaml,json}'],
    navigateFallback: 'index.html',
    runtimeCaching: [
      {
        urlPattern: ({ url }) => {
          const pathWithoutBase = url.pathname.replace("./", '');
          return pathWithoutBase.startsWith('songs/') ||
            pathWithoutBase.startsWith('assets/') ||
            pathWithoutBase === 'songDB.json' ||
            pathWithoutBase === 'songDB.hash';
        },
        handler: 'CacheFirst',
        options: {
          cacheName: 'app-content',
          cacheableResponse: {
            statuses: [0, 200]
          }
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
    cleanupOutdatedCaches: true
  },
  manifest: {
    name: "Domčíkův zpěvník v2",
    id: "cz.hodandom.domcikuv-zpevnik-v2",
    short_name: "Zpěvník",
    description: "Druhá verze mého báječného zpěvníku - nyní offline!",
    icons: [
      {
        src: "./assets/icons/icon-48x48.png",
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: "./assets/icons/favicon.svg",
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: "./assets/icons/icon-72x72.png",
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: "./assets/icons/icon-192x192.png",
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: "./assets/icons/icon-512x512.png",
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: "./assets/icons/icon-180x180.png",
        sizes: '180x180',
        type: 'image/png',
        purpose: 'apple touch icon',
      },
      {
        purpose: "maskable",
        sizes: "1024x1024",
        src: "./assets/icons/maskable_icon.png",
        type: "image/png"
      }
    ],
    screenshots: [
      {
        src: "./assets/screenshots/songlist_wide.png",
        sizes: "2560x1600",
        type: "image/png",
        form_factor: "wide",
        label: "Song list"
      },
      {
        src: "./assets/screenshots/songlist_iphone_xr.png",
        sizes: "828x1792",
        type: "image/png",
        form_factor: "narrow",
        label: "Song list"
      },
      {
        src: "./assets/screenshots/songview_wide.png",
        sizes: "2560x1600",
        type: "image/png",
        form_factor: "wide",
        label: "Song view"
      },
      {
        src: "./assets/screenshots/songview_iphone_xr.png",
        sizes: "828x1792",
        type: "image/png",
        form_factor: "narrow",
        label: "Song view"
      }
    ],
    theme_color: '#F28C28',
    background_color: '#fff2e5',
    display: "standalone",
    scope: basePath,
    start_url: basePath,
    orientation: 'portrait'
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaManifest),
    viteStaticCopy({
      targets: [
        {
          src: 'songs/*',
          dest: 'songs'
        },
        {
          src: 'src/assets/*',
          dest: 'assets'
        }
      ]
    }),
    Unfonts({
      google: {
        families: [
          {
            name: 'Poppins',
            styles: 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
          },
        ]
      }
    }),
  ],
  base: basePath,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      // output: {
      //   entryFileNames: 'assets/[name]-[hash].js',
      //   chunkFileNames: 'assets/[name]-[hash].js',
      //   assetFileNames: 'assets/[name]-[hash].[ext]'
      // }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})