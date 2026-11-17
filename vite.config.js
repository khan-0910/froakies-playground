import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run phone` serves over HTTPS on your LAN so a phone camera can scan.
export default defineConfig(({ mode }) => ({
  base: './', // works on any host, even in a sub-folder
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: { host: mode === 'phone' },
}))
