/**
 * Cloudflare Pages Function — /api/proxy
 * Proxies a URL server-side, bypassing browser CORS restrictions.
 * Usage: GET /api/proxy?url=<encoded-target-url>
 */
export async function onRequestGet({ request }) {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('url')

  if (!target) {
    return new Response('Missing url parameter', { status: 400 })
  }

  let parsed
  try {
    parsed = new URL(target)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response('Only http and https URLs are supported', { status: 400 })
    }
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  try {
    const upstream = await fetch(parsed.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MobileReader/1.0)' },
    })
    const body = await upstream.text()
    const ct = upstream.headers.get('content-type') ?? 'text/plain'
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new Response('Upstream fetch failed', { status: 502 })
  }
}
