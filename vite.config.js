import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // Important for Capacitor - relative paths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
