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
})
