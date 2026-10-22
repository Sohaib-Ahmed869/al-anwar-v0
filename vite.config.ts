import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Bundled JS/CSS goes to dist/build/, so it stays out of dist/assets/ —
    // that folder is a verbatim copy of public/assets/ and holds only our media.
    assetsDir: 'build',
  },
  server: {
    // 5173 is taken by another project on the development machine; a fixed,
    // uncommon port means the site, APP_URL and scripts/shot.mjs always agree.
    port: 5190,
    strictPort: true,
    // The platform API (server/) runs on 4600 in development; `npm run dev`
    // starts both. Same origin as far as the browser is concerned, so the
    // session cookies just work. API_PROXY_TARGET points it elsewhere instead,
    // e.g. the live site (`npm run dev:live`), which forwards on to Render.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4600',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
