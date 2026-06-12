# Mobile Reader — Product Specifications

> Use this document as the source of truth when writing enhancement prompts.
> Each section describes intent, constraints, and open decisions to resolve before building.

---

## Product Overview

A static web app that accepts a public URL, fetches the page via a CORS proxy,
extracts the main article content using Mozilla Readability, sanitizes it, and
renders a clean mobile-first reader view — similar to Safari Reader Mode.

**Core user flow:**
1. User pastes a URL into an input field
2. App fetches the page via the allorigins.win CORS proxy
3. App extracts article content with `@mozilla/readability`
4. App sanitizes HTML with `dompurify`
5. App renders a clean, typographically styled reader view

---

## Tech Stack

| Concern            | Choice                         | Notes                                           |
|--------------------|--------------------------------|-------------------------------------------------|
| Framework          | React 18 + Vite 5              | TypeScript strict mode                          |
| Styling            | Tailwind CSS v3                | `tailwind.config.cjs`, postcss pipeline         |
| Typography         | `@tailwindcss/typography`      | `prose` classes on article container            |
| Content extraction | `@mozilla/readability` ^0.5.0  | Requires `textContent.length >= 100` to succeed |
| Sanitization       | `dompurify` ^3.1               | Allowlist-based; strips scripts, iframes, events|
| CORS proxy         | `https://api.allorigins.win`   | Public proxy; rate limits apply                 |
| Testing            | Vitest 2 + Testing Library 16  | jsdom environment; globals: true                |
| HTTP mocking       | MSW 2 (`msw/node`)             | setupServer per spec file                       |
| Deployment         | Cloudflare Pages               | `public/_redirects` for SPA fallback            |

---

## Local Development

**Node.js: v22 required.** Vite 5 and Vitest 2 use modern syntax (`??=`, `&&=`) that
older Node (e.g. v14) cannot parse — running under an old version fails with
`SyntaxError: Unexpected token '??='`.

- An `.nvmrc` pins the version to `22`. With nvm installed, run `nvm use` in the repo
  (or `nvm install 22` first). The repo's default has been set via `nvm alias default 22`,
  so new shells pick up v22 automatically.
- The preview/dev launcher (`.claude/launch.json`) invokes the v22 `node` binary
  directly against `node_modules/vite/bin/vite.js`, because an `npm` shebang would
  otherwise resolve to whatever `node` is first on `PATH`.

```sh
nvm use          # selects v22 from .nvmrc
npm install
npm run dev      # vite dev server on :5173
npm run test:run # vitest (72 tests)
npm run build    # tsc -b && vite build
```

> Note: live `allorigins.win` fetches are firewalled inside the Claude preview sandbox,
> so the success/ReaderView path is only exercisable via the MSW-backed tests there.

---

## Iteration 1 — Implemented (Layers 1–4)

### Layer 1 — `src/lib/validateUrl.ts`

**Signature:** `validateUrl(input: string): { valid: true, url: string } | { valid: false, error: string }`

**Rules:**
- Trims whitespace before all checks
- Empty / whitespace-only → `"Please enter a URL"`
- Not parseable as URL → `"That doesn't look like a valid URL"`
- No protocol (e.g. `example.com`) → `"That doesn't look like a valid URL"`
- `ftp:` or other non-http(s) protocols → `"Only http and https URLs are supported"`
- `javascript:`, `data:`, `vbscript:`, `file:` → `"That URL type isn't supported"`
- Valid `http:` or `https:` URL → `{ valid: true, url: trimmedUrl }`

**Test count:** 14

---

### Layer 2 — `src/lib/fetchPage.ts`

**Signature:** `fetchPage(url: string): Promise<string>`

**Proxy URL:** `https://api.allorigins.win/get?url=<encodeURIComponent(url)>`

**Error types (both extend `Error`):**
- `NetworkError` — network unreachable or non-2xx HTTP status
- `ProxyError` — proxy reached but couldn't fetch the target

**Error messages:**
| Condition                                 | Type          | Message                                         |
|-------------------------------------------|---------------|-------------------------------------------------|
| `fetch()` rejects (offline)               | NetworkError  | `"Unable to reach the page — check your connection"` |
| Proxy HTTP status is non-2xx              | NetworkError  | `"The page returned an error (<status>)"`       |
| `status.http_code === 0`                  | ProxyError    | `"The proxy couldn't reach that page"`          |
| `contents` is null or empty string        | ProxyError    | `"The proxy couldn't reach that page"`          |

**Test count:** 11

---

### Layer 3 — `src/lib/extractContent.ts`

**Signature:** `extractContent(html: string, sourceUrl: string): { title: string, byline: string | null, content: string }`

**Error type:** `ExtractionError` (extends `Error`)
- Thrown when `Readability.parse()` returns null
- Thrown when extracted `textContent.trim().length < 100`
- Thrown when a plain-text source has `< 100` chars of text
- Message: `"We couldn't find a readable article on that page"`

**Plain-text sources (`.txt`, `.text`, `.md`, `.markdown`, `.log`):**
- Detected when the source URL has a text extension, OR the payload parses to no
  HTML elements (`doc.body.children.length === 0`) — i.e. bare text.
- Bypasses Readability. The text is converted to reading-friendly HTML:
  - Blank lines (`\n\s*\n`) become paragraph breaks (`<p>`).
  - Hard-wrapped lines inside a paragraph reflow into one run (single `\n` → space)
    so the text wraps naturally on mobile instead of keeping the source's ~70-col
    line breaks.
  - HTML special chars (`&`, `<`, `>`) are escaped, then run through the same
    DOMPurify allowlist.
- `title` is derived from the URL filename (trailing text extension stripped);
  `byline` is always `null`.

**URL resolution (pre-sanitize):**
- Relative `href` on `<a>` → absolute using `new URL(href, sourceUrl)`
- Relative `src` on `<img>` → absolute using `new URL(src, sourceUrl)`
- Skips: `http(s)://`, `mailto:`, `#`, `data:` (already absolute or special)

**DOMPurify allowlist:**

*Tags:* `a`, `article`, `b`, `blockquote`, `br`, `caption`, `code`, `del`, `details`, `div`,
`em`, `figcaption`, `figure`, `h1`–`h6`, `hr`, `i`, `img`, `ins`, `kbd`, `li`, `mark`,
`ol`, `p`, `pre`, `s`, `section`, `small`, `span`, `strong`, `sub`, `summary`, `sup`,
`table`, `tbody`, `td`, `th`, `thead`, `tr`, `u`, `ul`

*Attributes:* `href`, `src`, `srcset`, `alt`, `title`, `class`, `id`, `target`, `rel`,
`width`, `height`, `colspan`, `rowspan`

*Strips:* `<script>`, `<iframe>`, `<style>`, `onerror`, `onclick`, and all other event handlers

**Test count:** 24 (17 HTML + 7 plain-text)

---

### Layer 4 — `src/components/ReaderView.tsx`

**Signature:** `ReaderView({ title, byline, content })`

**Props:**
| Prop      | Type              | Behaviour                                    |
|-----------|-------------------|----------------------------------------------|
| `title`   | `string`          | Rendered in `<h1>`                           |
| `byline`  | `string \| null`  | Rendered in `<p>` when string; omitted when null |
| `content` | `string`          | Pre-sanitized HTML via `dangerouslySetInnerHTML` |

**Layout classes:**
- Outer wrapper: `px-4 py-6 max-w-2xl mx-auto`
- Title: `text-2xl font-bold mb-2`
- Byline: `text-sm text-gray-500 mb-6`
- Article body: `prose max-w-none prose-img:max-w-full`

**Table handling:** `<table>` elements in content are wrapped in
`<div class="overflow-x-auto">` via `DOMParser` before rendering (prevents horizontal overflow on mobile).

**Test count:** 10

---

## Iteration 2 — Implemented (Layers 5–6)

### Layer 5 — `src/components/UrlInput.tsx`

A controlled form component:
- Input field for the URL
- "Read" submit button
- Inline validation error (runs `validateUrl` on submit, not on keystroke)
- Error clears when user modifies the input
- Input and button disabled while `loading=true`

**Props:** `{ onSubmit: (url: string) => void, loading: boolean, error?: string }`

**Test count:** 10

---

### Layer 6 — `src/App.tsx` (native History API)

> **Routing:** implemented with the native History API + `URLSearchParams`, not
> react-router. The single `?url=` query-param contract below needs no router
> dependency; `pushState`/`popstate` cover history and back/forward.

**Routing strategy:** `/?url=<encoded-url>` — reader view driven by the `url` query param.
Browser back button returns to the empty input form.

**URL format:** `/?url=https%3A%2F%2Fexample.com%2Farticle`

**States:**
| State      | Trigger                                  | UI                          |
|------------|------------------------------------------|-----------------------------|
| Idle       | Initial load, no `?url` param            | `UrlInput` form             |
| Loading    | `?url` param present, fetch in progress  | Spinner + disabled input    |
| Success    | Fetch + extraction complete              | `ReaderView`                |
| Error      | `NetworkError`, `ProxyError`, or `ExtractionError` | Error message + back button |

**Error messages by type:**
- `NetworkError` → show the error's `.message` directly (already user-friendly)
- `ProxyError` → show the error's `.message` directly
- `ExtractionError` → show the error's `.message` directly
- Unknown error → `"Something went wrong. Please try again."`

**Navigation:** Submitting a URL pushes `/?url=<encoded>` to browser history.
The "Try another URL" / "Read another" button navigates to `/` (clears the param);
the browser back/forward buttons restore the corresponding state via `popstate`.

**Test count:** 10

---

## Constraints & Known Limitations

| Constraint                  | Detail                                                              |
|-----------------------------|---------------------------------------------------------------------|
| CORS proxy                  | allorigins.win is a public free service; may be rate-limited or unavailable |
| Authentication              | Only publicly accessible pages are supported (no cookies/auth)     |
| Dynamic JS-rendered pages   | Pages that require JavaScript execution to load content will fail extraction |
| Minimum content             | Pages with fewer than 100 characters of extracted text throw `ExtractionError` |
| Image proxying              | Images load from their original domain; may fail if hotlink-protected |
| Plain-text files            | Supported (`.txt`, `.text`, `.md`, `.markdown`, `.log`) — formatted as reflowed paragraphs, no rich structure |
| PDF / other binary content  | Not supported; allorigins returns raw bytes that neither Readability nor the text formatter can parse |

---

## Enhancement Ideas (future prompts)

- **Font size / line height controls** — user preference stored in `localStorage`
- **Dark mode toggle** — Tailwind `dark:` variant, persisted in `localStorage`
- **Reading progress indicator** — scroll-position progress bar at the top
- **Estimated reading time** — word count ÷ 200 wpm shown next to byline
- **Share the reader URL** — copy `/?url=...` to clipboard button
- **Offline / PWA support** — service worker caching of fetched articles
- **Image lazy-loading** — add `loading="lazy"` to all `<img>` tags post-extraction
- **Self-hosted proxy** — Cloudflare Worker as a first-party CORS proxy to avoid rate limits
- **History / bookmarks** — `localStorage` list of recently read URLs
