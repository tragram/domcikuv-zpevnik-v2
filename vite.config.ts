import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
  viteStaticCopy({
    targets: [
      {
        src: 'songs/*',
        dest: 'songs'
      }
    ]
  })],
  base: "/domcikuv-zpevnik-v2",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
