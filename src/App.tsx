import { useCallback, useEffect, useState } from 'react'
import { UrlInput } from './components/UrlInput'
import { ReaderView } from './components/ReaderView'
import { fetchPage, NetworkError, ProxyError } from './lib/fetchPage'
import { extractContent, ExtractionError } from './lib/extractContent'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface Article {
  title: string
  byline: string | null
  content: string
}

function getUrlParam(): string | null {
  return new URLSearchParams(window.location.search).get('url')
}

function errorMessage(err: unknown): string {
  if (
    err instanceof NetworkError ||
    err instanceof ProxyError ||
    err instanceof ExtractionError
  ) {
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

export default function App() {
  const [url, setUrl] = useState<string | null>(getUrlParam)
  const [status, setStatus] = useState<Status>(getUrlParam() ? 'loading' : 'idle')
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState('')

  // Keep state in sync with browser back/forward navigation.
  useEffect(() => {
    function handlePopState() {
      setUrl(getUrlParam())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Fetch + extract whenever the active URL changes.
  useEffect(() => {
    if (!url) {
      setStatus('idle')
      setArticle(null)
      setError('')
      return
    }

    let cancelled = false
    setStatus('loading')
    setArticle(null)
    setError('')

    ;(async () => {
      try {
        const html = await fetchPage(url)
        const result = extractContent(html, url)
        if (cancelled) return
        setArticle(result)
        setStatus('success')
      } catch (err) {
        if (cancelled) return
        setError(errorMessage(err))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url])

  const handleSubmit = useCallback((submittedUrl: string) => {
    window.history.pushState({}, '', `/?url=${encodeURIComponent(submittedUrl)}`)
    setUrl(submittedUrl)
  }, [])

  const handleReset = useCallback(() => {
    window.history.pushState({}, '', '/')
    setUrl(null)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {status === 'success' && article ? (
        <div>
          <div className="border-b border-gray-100 px-4 py-3 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              ← Read another
            </button>
          </div>
          <ReaderView
            title={article.title}
            byline={article.byline}
            content={article.content}
          />
        </div>
      ) : (
        <main className="px-4 py-16 max-w-md mx-auto">
          <h1 className="mb-1 text-2xl font-bold">Mobile Reader</h1>
          <p className="mb-6 text-sm text-gray-500">
            Paste a link to read it in a clean, distraction-free view.
          </p>

          {status === 'error' ? (
            <div role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <UrlInput
            onSubmit={handleSubmit}
            loading={status === 'loading'}
          />

          {status === 'loading' && (
            <div
              role="status"
              aria-label="Loading article"
              className="mt-6 flex items-center gap-2 text-sm text-gray-500"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              Fetching article…
            </div>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              ← Try another URL
            </button>
          )}
        </main>
      )}
    </div>
  )
}
