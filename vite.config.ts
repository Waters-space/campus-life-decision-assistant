import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = Number(env.API_PORT || 8788)

  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT || 5174),
      strictPort: true,
      allowedHosts: ['.loca.lt', '.trycloudflare.com'],
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
  }
})
