import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handle } from './netlify/lib/rewrite/server.ts'

function apiPlugin(): Plugin {
  return {
    name: 'rg-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks)
        const host = req.headers.host || 'localhost:5173'
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value == null) continue
          headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        }
        const request = new Request(`http://${host}${url}`, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        })
        const response = await handle(request, {
          RG_DEV_MAILBOX: '1',
          RG_STORE_FILE: '/tmp/rg-rewrite-store.json',
          CONTEXT: 'dev',
          country: 'CA',
        })
        res.statusCode = response.status
        response.headers.forEach((value, key) => {
          if (key === 'set-cookie') res.setHeader('set-cookie', value)
          else res.setHeader(key, value)
        })
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), apiPlugin()],
})
