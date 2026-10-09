import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Relative base works on Surge, Netlify, Cloudflare, and GitHub Pages.
  base: './',
  plugins: [
    react(),
    {
      // 10.09: /roman-owner/ (trailing slash) must still find the owner page's files, so owner.html uses root paths
      name: 'owner-html-absolute-assets',
      enforce: 'post',
      generateBundle(_opts, bundle) {
        const html = bundle['owner.html']
        if (html && html.type === 'asset' && typeof html.source === 'string') html.source = html.source.replace(/(src|href)="\.\//g, '$1="/')
      },
    },
  ],
  build: {
    // 10.09: owner.html is the stand-alone owner page (/roman-owner rewrites to it)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        owner: fileURLToPath(new URL('./owner.html', import.meta.url)),
      },
    },
  },
})
