import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Konfigurasi untuk development lokal
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    // Konfigurasi KRUSIAL untuk Cloud Run / Production Preview
    // Mengizinkan akses dari luar container (0.0.0.0)
    host: '0.0.0.0',
    // Memaksa berjalan di port 8080 sesuai standar Cloud Run
    port: 8080,
    // Mengizinkan semua host (penting untuk domain dinamis Cloud Run)
    allowedHosts: true,
  },
})