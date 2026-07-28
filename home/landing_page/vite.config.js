import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Optional: VITE_SITE_URL=https://www.yourdomain.com (canonical & OG when not using window.location.origin)
export default defineConfig({
  plugins: [react()],
})
