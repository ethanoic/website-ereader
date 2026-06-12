import { describe, it, expect } from 'vitest'
import { extractContent, ExtractionError } from './extractContent'

const SOURCE_URL = 'https://example.com/article'

// Enough content for Readability's threshold (~500 chars of body text)
const ARTICLE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>Test Article Title</title></head>
  <body>
    <header><nav>Site Navigation</nav></header>
    <main>
      <article>
        <h1>Test Article Title</h1>
        <p class="byline">By Jane Doe</p>
        <p>This is the first paragraph of the article. It contains enough text to be
        detected as an article by Readability. We need several sentences of content
        here to ensure the extraction works correctly and the library does not reject
        the document as non-article content.</p>
        <p>This is the second paragraph with more content. Readability requires a
        minimum amount of text before it considers a document to be a proper article
        worth extracting. Adding sufficient content here ensures reliable test results.</p>
        <img src="/images/photo.jpg" alt="A photo" />
        <p>Check out <a href="/relative-link">this relative link</a> and
        <a href="https://external.com">this external link</a>.</p>
        <pre><code>const hello = "world";</code></pre>
        <table>
          <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
          <tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody>
        </table>
      </article>
    </main>
    <footer>Footer content</footer>
  </body>
</html>
`

describe('extractContent()', () => {
  describe('article metadata', () => {
    it('extracts the article title', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.title).toBeTruthy()
      expect(typeof result.title).toBe('string')
    })

    it('returns null for byline when no author information is present', () => {
      const noBylineHtml = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article Without Byline</h1>
          <p>This article has no author byline. It contains enough text that Readability
          should successfully extract it as a proper article. Adding more sentences here
          to ensure the content threshold is met for the extraction library.</p>
          <p>Second paragraph to make sure Readability parses this correctly and returns
          an article object with a null byline field rather than rejecting the document.</p>
        </article></body></html>
      `
      const result = extractContent(noBylineHtml, SOURCE_URL)
      expect(result.byline).toBeNull()
    })
  })

  describe('content extraction', () => {
    it('returns the main article body text', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('first paragraph')
    })

    it('strips nav/header/footer from the content', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).not.toContain('Site Navigation')
      expect(result.content).not.toContain('Footer content')
    })
  })

  describe('content preservation — allowed elements', () => {
    it('preserves <img> tags within the article body', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('<img')
    })

    it('preserves <a href> links', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('<a ')
      expect(result.content).toContain('href=')
    })

    it('resolves relative href links to absolute URLs using the source URL', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).not.toMatch(/href="\/relative-link"/)
      expect(result.content).toContain('https://example.com/relative-link')
    })

    it('resolves relative image src to absolute URL', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('https://example.com/images/photo.jpg')
    })

    it('preserves <pre><code> blocks', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('<pre>')
      expect(result.content).toContain('<code>')
    })

    it('preserves <table> elements', () => {
      const result = extractContent(ARTICLE_HTML, SOURCE_URL)
      expect(result.content).toContain('<table')
    })
  })

  describe('sanitization (DOMPurify)', () => {
    it('strips <script> tags from extracted content', () => {
      const html = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article</h1>
          <p>Content with enough text for Readability to detect as a valid article.
          More sentences are needed here to reach the minimum content threshold
          that the library uses before attempting extraction.</p>
          <p>Second paragraph with extra content to be safe about the threshold.</p>
          <script>alert('xss')<\/script>
        </article></body></html>
      `
      const result = extractContent(html, SOURCE_URL)
      expect(result.content).not.toContain('<script>')
      expect(result.content).not.toContain("alert('xss')")
    })

    it('strips <iframe> tags from extracted content', () => {
      const html = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article</h1>
          <p>Content with enough text for Readability to parse. Adding multiple sentences
          to ensure the minimum content length requirement is satisfied by the library.</p>
          <p>Second paragraph for sufficient content to pass Readability detection.</p>
          <iframe src="https://malicious.com"></iframe>
        </article></body></html>
      `
      const result = extractContent(html, SOURCE_URL)
      expect(result.content).not.toContain('<iframe')
    })

    it('strips onerror attributes from <img> tags', () => {
      const html = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article</h1>
          <p>Content with enough text for Readability. Sentences ensure the content
          threshold is met so the library returns an article object successfully.</p>
          <p>Second paragraph for additional content length to satisfy Readability.</p>
          <img src="photo.jpg" onerror="alert('xss')" alt="photo" />
        </article></body></html>
      `
      const result = extractContent(html, SOURCE_URL)
      expect(result.content).not.toContain('onerror')
    })

    it('strips onclick attributes from elements', () => {
      const html = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article</h1>
          <p onclick="alert('xss')">Content with enough text for Readability to detect.
          More text here to ensure the content threshold is met for successful parsing.</p>
          <p>Second paragraph with additional content to reach the minimum length.</p>
        </article></body></html>
      `
      const result = extractContent(html, SOURCE_URL)
      expect(result.content).not.toContain('onclick')
    })

    it('strips <style> tags from extracted content', () => {
      const html = `
        <!DOCTYPE html><html><head><title>Article</title></head>
        <body><article>
          <h1>Article</h1>
          <p>Content with enough text for Readability to detect and parse correctly.
          More sentences to ensure we reach the minimum content threshold required.</p>
          <p>Second paragraph for additional content to satisfy the library requirements.</p>
          <style>.hidden { display: none; }<\/style>
        </article></body></html>
      `
      const result = extractContent(html, SOURCE_URL)
      expect(result.content).not.toContain('<style>')
    })
  })

  describe('plain-text sources', () => {
    const TXT_URL = 'https://classics.mit.edu/Aristotle/rhetoric.mb.txt'
    const PLAIN_TEXT = [
      'Rhetoric',
      'By Aristotle',
      '',
      'Rhetoric is the counterpart of Dialectic. Both alike are concerned with such',
      'things as come, more or less, within the general ken of all men and belong to',
      'no definite science.',
      '',
      'Accordingly all men make use, more or less, of both; for to a certain extent',
      'all men attempt to discuss statements and to maintain them, to defend',
      'themselves and to attack others.',
    ].join('\n')

    it('formats a .txt URL into paragraphs instead of throwing', () => {
      const result = extractContent(PLAIN_TEXT, TXT_URL)
      expect(result.content).toContain('<p>')
      expect(result.content).toContain('Rhetoric is the counterpart of Dialectic')
    })

    it('reflows hard-wrapped lines within a paragraph (no mid-paragraph breaks)', () => {
      const result = extractContent(PLAIN_TEXT, TXT_URL)
      expect(result.content).toContain(
        'Rhetoric is the counterpart of Dialectic. Both alike are concerned with such things as come',
      )
    })

    it('splits paragraphs on blank lines', () => {
      const result = extractContent(PLAIN_TEXT, TXT_URL)
      const paragraphs = result.content.match(/<p>/g) ?? []
      expect(paragraphs.length).toBeGreaterThanOrEqual(3)
    })

    it('derives a title from the filename and has no byline', () => {
      const result = extractContent(PLAIN_TEXT, TXT_URL)
      expect(result.title).toContain('rhetoric')
      expect(result.title).not.toContain('.txt')
      expect(result.byline).toBeNull()
    })

    it('treats text served without an HTML structure as plain text', () => {
      const result = extractContent(PLAIN_TEXT, 'https://example.com/no-extension')
      expect(result.content).toContain('<p>')
    })

    it('escapes HTML special characters in the text', () => {
      const text =
        'A line with <script>alert(1)</script> and an & ampersand. '.repeat(4)
      const result = extractContent(text, 'https://example.com/notes.txt')
      expect(result.content).not.toContain('<script>')
      expect(result.content).toContain('&amp;')
    })

    it('still throws ExtractionError for a too-short text file', () => {
      expect(() => extractContent('tiny', 'https://example.com/a.txt')).toThrow(
        ExtractionError,
      )
    })
  })

  describe('failure cases', () => {
    it('throws ExtractionError when Readability cannot find article content', () => {
      const noArticleHtml = `
        <!DOCTYPE html><html><head><title>No Article</title></head>
        <body><p>Short.</p></body></html>
      `
      expect(() => extractContent(noArticleHtml, SOURCE_URL)).toThrow(ExtractionError)
      expect(() => extractContent(noArticleHtml, SOURCE_URL)).toThrow(
        "We couldn't find a readable article on that page",
      )
    })

    it('throws ExtractionError for an HTML page with no body content', () => {
      const emptyHtml = `<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>`
      expect(() => extractContent(emptyHtml, SOURCE_URL)).toThrow(ExtractionError)
    })
  })
})
