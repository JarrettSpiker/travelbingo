import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        // In production the API is same-origin: CloudFront routes /api/* to API
        // Gateway. This makes local dev match, so the app never needs a separate
        // base URL or any CORS handling.
        //
        // Set VITE_API_TARGET in frontend/.env.local to point at a deployed
        // environment. Without it there is simply no API locally, and the
        // editor, randomize, print, PNG, and ?card= sharing all still work —
        // which is the behaviour that must never regress.
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
