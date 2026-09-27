import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Root is pinned to this file's directory so the build works when npm runs from the
// repository root, where the config is passed with --config.
const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
})
