import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      // Proxy Vosk model downloads to avoid CORS issues
      '/vosk-models': {
        target: 'https://alphacephei.com/vosk/models',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vosk-models/, ''),
      },
    },
  },
})
