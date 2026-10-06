import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base works on Surge, Netlify, Cloudflare, and GitHub Pages.
  base: './',
  plugins: [react()],
})
