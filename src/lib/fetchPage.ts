// VITE_PROXY_URL can override the proxy base (e.g. a self-hosted Cloudflare Worker).
// In dev the Vite middleware serves /api/proxy; in production Cloudflare Pages
// serves it via functions/api/proxy.js — so the default of '/api/proxy' works
// in both environments without any env-var configuration.
const PROXY_BASE = import.meta.env.VITE_PROXY_URL ?? '/api/proxy'

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ProxyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProxyError'
  }
}

export async function fetchPage(url: string): Promise<string> {
  const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(url)}`

  let response: Response
  try {
    response = await fetch(proxyUrl)
  } catch {
    throw new NetworkError('Unable to reach the page — check your connection')
  }

  if (!response.ok) {
    throw new NetworkError(`The page returned an error (${response.status})`)
  }

  return response.text()
}
