import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // rutas relativas: el build funciona servido desde cualquier subdirectorio
  base: './',
  server: {
    port: 5173,
  },
})
