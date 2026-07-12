/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TAURI_ENV_PLATFORM is injected by the Tauri CLI during both `tauri dev` and `tauri build`
const isTauri = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  base: isTauri ? '/' : '/Sentinel/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
