import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  }
})