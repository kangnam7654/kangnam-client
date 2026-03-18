import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Standalone Vite config for Tauri (renderer only, no electron-vite)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'safari15',
    minify: 'esbuild'
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
