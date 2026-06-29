import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// All Node.js built-ins and native modules that must NOT be bundled
const mainExternals = [
  'electron',
  'better-sqlite3',
  'path',
  'fs',
  'url',
  'util',
  'os',
  'crypto',
  'stream',
  'assert',
  'buffer',
  'child_process',
  'net',
  'http',
  'https',
]

export default defineConfig({
  main: {
    // NOTE: NOT using externalizeDepsPlugin — it conflicts with native module bundling
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: mainExternals,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        external: ['electron'],
      },
    },
  },
  renderer: {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
      },
    },
    build: {
      outDir: 'out/renderer',
    },
  },
})
