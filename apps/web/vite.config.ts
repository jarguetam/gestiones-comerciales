import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { requireBuildEnv } from './src/lib/env'

function enforceEnv(): Plugin {
  return {
    name: 'gc-enforce-env',
    configResolved(config) {
      const loaded = loadEnv(config.mode, config.root, '')
      requireBuildEnv({ ...loaded, ...process.env })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), enforceEnv()],
  // rutas relativas: el build funciona servido desde cualquier subdirectorio
  base: './',
  server: {
    port: 5173,
  },
})
