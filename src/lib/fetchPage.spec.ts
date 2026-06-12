import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { fetchPage, NetworkError } from './fetchPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const TARGET_URL = 'https://example.com/article'
// Set via test.env in vite.config.ts so MSW can intercept it in jsdom.
const PROXY_BASE = 'http://localhost/api/proxy'

describe('fetchPage()', () => {
  describe('proxy URL construction', () => {
    it('calls the proxy with the target URL encoded as a query param', async () => {
      let calledUrl = ''
      server.use(
        http.get(PROXY_BASE, ({ request }) => {
          calledUrl = request.url
          return new HttpResponse('<html><body>test</body></html>', { status: 200 })
        }),
      )
      await fetchPage(TARGET_URL)
      expect(calledUrl).toBe(`${PROXY_BASE}?url=${encodeURIComponent(TARGET_URL)}`)
    })

    it('percent-encodes special characters in the target URL', async () => {
      const urlWithQuery = 'https://example.com/article?id=1&page=2'
      let calledUrl = ''
      server.use(
        http.get(PROXY_BASE, ({ request }) => {
          calledUrl = request.url
          return new HttpResponse('<html><body>test</body></html>', { status: 200 })
        }),
      )
      await fetchPage(urlWithQuery)
      expect(calledUrl).toContain(encodeURIComponent(urlWithQuery))
    })
  })

  describe('success', () => {
    it('returns the raw response text', async () => {
      const html = '<html><body><article>Hello world</article></body></html>'
      server.use(http.get(PROXY_BASE, () => new HttpResponse(html, { status: 200 })))
      const result = await fetchPage(TARGET_URL)
      expect(result).toBe(html)
    })

    it('handles a large payload without truncation', async () => {
      const largeHtml = '<html><body>' + 'a'.repeat(100_000) + '</body></html>'
      server.use(http.get(PROXY_BASE, () => new HttpResponse(largeHtml, { status: 200 })))
      const result = await fetchPage(TARGET_URL)
      expect(result.length).toBe(largeHtml.length)
    })

    it('returns plain text responses unchanged', async () => {
      const text = 'Rhetoric\nBy Aristotle\n\nRhetoric is the counterpart of Dialectic.'
      server.use(
        http.get(PROXY_BASE, () =>
          new HttpResponse(text, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
        ),
      )
      const result = await fetchPage(TARGET_URL)
      expect(result).toBe(text)
    })
  })

  describe('HTTP errors', () => {
    it('throws NetworkError("The page returned an error (404)") for a 404', async () => {
      server.use(http.get(PROXY_BASE, () => new HttpResponse(null, { status: 404 })))
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(NetworkError)
      await expect(fetchPage(TARGET_URL)).rejects.toThrow('The page returned an error (404)')
    })

    it('throws NetworkError("The page returned an error (500)") for a 500', async () => {
      server.use(http.get(PROXY_BASE, () => new HttpResponse(null, { status: 500 })))
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(NetworkError)
      await expect(fetchPage(TARGET_URL)).rejects.toThrow('The page returned an error (500)')
    })

    it('throws NetworkError("The page returned an error (403)") for a 403', async () => {
      server.use(http.get(PROXY_BASE, () => new HttpResponse(null, { status: 403 })))
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(NetworkError)
      await expect(fetchPage(TARGET_URL)).rejects.toThrow('The page returned an error (403)')
    })

    it('throws NetworkError when the proxy itself returns 502 (upstream unreachable)', async () => {
      server.use(http.get(PROXY_BASE, () => new HttpResponse(null, { status: 502 })))
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(NetworkError)
      await expect(fetchPage(TARGET_URL)).rejects.toThrow('The page returned an error (502)')
    })
  })

  describe('network failures', () => {
    it('throws NetworkError when fetch rejects (offline / network down)', async () => {
      server.use(http.get(PROXY_BASE, () => HttpResponse.error()))
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(NetworkError)
      await expect(fetchPage(TARGET_URL)).rejects.toThrow(
        'Unable to reach the page — check your connection',
      )
    })
  })
})
