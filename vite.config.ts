import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-cors-proxy',
      configureServer(server) {
        server.middlewares.use(
          '/api/proxy',
          async (req: IncomingMessage, res: ServerResponse) => {
            const qs = req.url?.slice(1) ?? ''
            const target = new URLSearchParams(qs).get('url')

            if (!target) {
              res.statusCode = 400
              res.end('Missing url parameter')
              return
            }

            let parsed: URL
            try {
              parsed = new URL(target)
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                res.statusCode = 400
                res.end('Only http and https URLs are supported')
                return
              }
            } catch {
              res.statusCode = 400
              res.end('Invalid URL')
              return
            }

            try {
              const upstream = await fetch(parsed.href)
              res.statusCode = upstream.status
              const ct = upstream.headers.get('content-type')
              if (ct) res.setHeader('Content-Type', ct)
              res.end(await upstream.text())
            } catch {
              res.statusCode = 502
              res.end()
            }
          },
        )
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      // Absolute URL so MSW can intercept in the jsdom test environment.
      // The actual app (dev + prod) uses the relative '/api/proxy' fallback.
      VITE_PROXY_URL: 'http://localhost/api/proxy',
    },
  },
})
