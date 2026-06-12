import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import App from './App'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  window.history.pushState({}, '', '/')
})
afterAll(() => server.close())

// Matches VITE_PROXY_URL set in vite.config.ts test.env
const PROXY_BASE = 'http://localhost/api/proxy'
const TARGET = 'https://example.com/article'

const ARTICLE_HTML = `
  <html><head><title>A Great Read</title></head>
  <body><article>
    <h1>A Great Read</h1>
    <p>${'This is a sufficiently long paragraph of article body text. '.repeat(6)}</p>
  </article></body></html>`

function proxyReturns(body: string, status = 200) {
  server.use(http.get(PROXY_BASE, () => new HttpResponse(body, { status })))
}

describe('<App />', () => {
  describe('idle state', () => {
    it('renders the URL input form when there is no ?url param', () => {
      render(<App />)
      expect(screen.getByRole('button', { name: 'Read' })).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('happy path', () => {
    it('fetches, extracts, and renders the ReaderView after submitting a URL', async () => {
      const user = userEvent.setup()
      proxyReturns(ARTICLE_HTML)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(
        await screen.findByRole('heading', { level: 1, name: 'A Great Read' }),
      ).toBeInTheDocument()
    })

    it('pushes /?url=<encoded> to history on submit', async () => {
      const user = userEvent.setup()
      proxyReturns(ARTICLE_HTML)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      await screen.findByRole('heading', { level: 1 })
      expect(window.location.search).toBe(`?url=${encodeURIComponent(TARGET)}`)
    })

    it('auto-loads the article when ?url is already present on mount', async () => {
      window.history.pushState({}, '', `/?url=${encodeURIComponent(TARGET)}`)
      proxyReturns(ARTICLE_HTML)
      render(<App />)

      expect(
        await screen.findByRole('heading', { level: 1, name: 'A Great Read' }),
      ).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows a loading status while the fetch is in flight', async () => {
      const user = userEvent.setup()
      server.use(
        http.get(PROXY_BASE, async () => {
          await delay(50)
          return new HttpResponse(ARTICLE_HTML, { status: 200 })
        }),
      )
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(await screen.findByRole('status')).toBeInTheDocument()
      await screen.findByRole('heading', { level: 1 })
    })
  })

  describe('error states', () => {
    it('shows a NetworkError when the proxy cannot reach the upstream (502)', async () => {
      const user = userEvent.setup()
      proxyReturns('', 502)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The page returned an error (502)',
      )
    })

    it('shows the ExtractionError message when no readable article is found', async () => {
      const user = userEvent.setup()
      proxyReturns('<html><body><p>too short</p></body></html>')
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "We couldn't find a readable article on that page",
      )
    })

    it('shows the NetworkError message on an HTTP error from the proxy', async () => {
      const user = userEvent.setup()
      proxyReturns('', 500)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The page returned an error (500)',
      )
    })

    it('returns to the input form when "Try another URL" is clicked after an error', async () => {
      const user = userEvent.setup()
      proxyReturns('', 502)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: /try another url/i }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Read' })).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })
  })

  describe('navigation', () => {
    it('"Read another" from the reader view returns to the form', async () => {
      const user = userEvent.setup()
      proxyReturns(ARTICLE_HTML)
      render(<App />)

      await user.type(screen.getByRole('textbox'), TARGET)
      await user.click(screen.getByRole('button', { name: 'Read' }))
      await screen.findByRole('heading', { level: 1 })

      await user.click(screen.getByRole('button', { name: /read another/i }))

      expect(screen.getByRole('button', { name: 'Read' })).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })
  })
})
