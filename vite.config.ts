import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

function portalResolve(): Plugin {
  const map: Record<string, string> = {
    '/cloud/cloud': path.resolve(root, 'src/portal/stubs/cloud.ts'),
    '/cloud/CloudScores': path.resolve(root, 'src/portal/stubs/CloudScores.tsx'),
    '/components/BugReport': path.resolve(root, 'src/portal/stubs/BugReport.tsx'),
    '/game/publicUrl': path.resolve(root, 'src/portal/stubs/publicUrl.ts'),
    '/publicUrl': path.resolve(root, 'src/portal/stubs/publicUrl.ts'),
    '/portal/install': path.resolve(root, 'src/portal/install.portal.ts'),
  }
  return {
    name: 'roman-portal-resolve',
    enforce: 'pre',
    resolveId(source) {
      const hit = Object.keys(map).find((key) => source.endsWith(key) || source.endsWith(`${key}.ts`) || source.endsWith(`${key}.tsx`))
      return hit ? map[hit] : undefined
    },
  }
}
function portalHtml(portal: 'crazygames' | 'poki'): Plugin {
  return {
    name: 'roman-portal-html',
    transformIndexHtml(html) {
      let out = html
      out = out.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>/, '')
      out = out.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/, '')
      out = out.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet" \/>/, '')
      out = out.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
      out = out.replace(/\s*<!-- 9\.32-e: Google Analytics[\s\S]*?<\/script>/, '')
      out = out.replace(/\s*<link rel="canonical"[^>]*>/, '')
      out = out.replace(/\s*<meta property="og:url"[^>]*>/, '')
      out = out.replace(/\s*<meta property="og:image"[^>]*>/, '')
      out = out.replace(/\s*<meta property="og:image:width"[^>]*>/, '')
      out = out.replace(/\s*<meta property="og:image:height"[^>]*>/, '')
      out = out.replace(/\s*<meta name="twitter:image"[^>]*>/, '')
      out = out.replace(/\s*<link rel="alternate"[^>]*>/, '')
      out = out.replace(/href="\/llms\.txt"/g, 'href="./llms.txt"')
      out = out.replace('<body>', `<body class="portal-${portal}">`)
      if (portal === 'poki') {
        out = out.replace(
          '<meta charset="UTF-8" />',
          '<meta charset="UTF-8" />\n    <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
        )
      }
      return out
    },
  }
}

export default defineConfig(({ mode }) => {
  const portal = mode === 'crazygames' || mode === 'poki' ? mode : ''
  return {
    base: './',
    plugins: [react(), ...(portal ? [portalResolve(), portalHtml(portal)] : [])],
    define: {
      __PORTAL_BUILD__: portal ? 'true' : 'false',
      'import.meta.env.VITE_PORTAL': JSON.stringify(portal),
    },
  }
})
