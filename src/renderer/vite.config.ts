// Vite config for renderer dev server only
// Used by 'npm run dev' for HMR development
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  build: {
    outDir: resolve(__dirname, '../../out/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
