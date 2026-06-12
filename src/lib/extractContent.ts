import { Readability } from '@mozilla/readability'
import DOMPurify from 'dompurify'

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

const ALLOWED_TAGS = [
  'a', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'del',
  'details', 'div', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark',
  'ol', 'p', 'pre', 's', 'section', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]

const ALLOWED_ATTR = [
  'href', 'src', 'srcset', 'alt', 'title', 'class', 'id',
  'target', 'rel', 'width', 'height', 'colspan', 'rowspan',
]

const TEXT_EXTENSIONS = ['.txt', '.text', '.md', '.markdown', '.log']

/** True when the source URL points at a known plain-text file type. */
function isPlainTextUrl(sourceUrl: string): boolean {
  try {
    const path = new URL(sourceUrl).pathname.toLowerCase()
    return TEXT_EXTENSIONS.some(ext => path.endsWith(ext))
  } catch {
    return false
  }
}

/** True when the payload parses into actual HTML elements (vs. bare text). */
function looksLikeHtml(html: string): boolean {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.body.children.length > 0
}

/** Derives a human title from the source URL's filename. */
function fileNameTitle(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl)
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
    if (!last) return url.hostname
    const stripped = last.replace(/\.(txt|text|md|markdown|log)$/i, '')
    return stripped || last
  } catch {
    return sourceUrl
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Converts a plain-text document into reading-friendly HTML: blank lines become
 * paragraph breaks, and hard-wrapped lines within a paragraph reflow into one
 * continuous run so the text wraps naturally on mobile.
 */
function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized
    .split(/\n[ \t]*\n+/)
    .map(block => block.trim())
    .filter(block => block.length > 0)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ')}</p>`)
    .join('')
}

function extractPlainText(
  text: string,
  sourceUrl: string,
): { title: string; byline: string | null; content: string } {
  if (text.trim().length < 100) {
    throw new ExtractionError("We couldn't find a readable article on that page")
  }

  const clean = DOMPurify.sanitize(plainTextToHtml(text), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: true,
  })

  return {
    title: fileNameTitle(sourceUrl),
    byline: null,
    content: clean,
  }
}

function resolveUrls(html: string, baseUrl: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const base = new URL(baseUrl)

  doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    const href = a.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
      try {
        a.setAttribute('href', new URL(href, base).href)
      } catch {
        // leave as-is if resolution fails
      }
    }
  })

  doc.querySelectorAll<HTMLImageElement>('img[src]').forEach(img => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try {
        img.setAttribute('src', new URL(src, base).href)
      } catch {
        // leave as-is
      }
    }
  })

  return doc.body.innerHTML
}

export function extractContent(
  html: string,
  sourceUrl: string,
): { title: string; byline: string | null; content: string } {
  // Plain-text sources (.txt, .md, …) have no article structure for Readability
  // to find — format them directly instead of returning an empty-title blob.
  if (isPlainTextUrl(sourceUrl) || !looksLikeHtml(html)) {
    return extractPlainText(html, sourceUrl)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const base = doc.createElement('base')
  base.setAttribute('href', sourceUrl)
  doc.head.prepend(base)

  const reader = new Readability(doc)
  const article = reader.parse()

  if (!article || article.textContent.trim().length < 100) {
    throw new ExtractionError("We couldn't find a readable article on that page")
  }

  const resolved = resolveUrls(article.content, sourceUrl)

  const clean = DOMPurify.sanitize(resolved, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: true,
  })

  return {
    title: article.title,
    byline: article.byline || null,
    content: clean,
  }
}
