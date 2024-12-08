import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import Unfonts from 'unplugin-fonts/vite'

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
  base: "/domcikuv-zpevnik-v2",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
