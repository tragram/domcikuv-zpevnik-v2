import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),
  viteStaticCopy({
    targets: [
      {
        src: 'songs/*',
        dest: 'songs'
      }
    ]
  })

  ],
  base: "/domcikuv-zpevnik-v2",

  assetsInclude: ["/songs/images/*"],
})
