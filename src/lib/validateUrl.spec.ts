import { describe, it, expect } from 'vitest'
import { validateUrl } from './validateUrl'

describe('validateUrl()', () => {
  describe('valid inputs', () => {
    it('returns valid=true for "https://example.com"', () => {
      expect(validateUrl('https://example.com')).toEqual({ valid: true, url: 'https://example.com' })
    })

    it('returns valid=true for "http://example.com"', () => {
      expect(validateUrl('http://example.com')).toEqual({ valid: true, url: 'http://example.com' })
    })

    it('returns valid=true for a URL with a path', () => {
      expect(validateUrl('https://example.com/some/article')).toEqual({
        valid: true,
        url: 'https://example.com/some/article',
      })
    })

    it('returns valid=true for a URL with query params', () => {
      expect(validateUrl('https://example.com?page=1')).toEqual({
        valid: true,
        url: 'https://example.com?page=1',
      })
    })

    it('trims surrounding whitespace before validating', () => {
      const result = validateUrl('  https://example.com  ')
      expect(result.valid).toBe(true)
    })

    it('returns the trimmed URL in the valid result', () => {
      const result = validateUrl('  https://example.com  ')
      if (result.valid) {
        expect(result.url).toBe('https://example.com')
      }
    })
  })

  describe('invalid inputs — empty / not a URL', () => {
    it('returns valid=false with error "Please enter a URL" for an empty string', () => {
      expect(validateUrl('')).toEqual({ valid: false, error: 'Please enter a URL' })
    })

    it('returns valid=false with error "Please enter a URL" for a whitespace-only string', () => {
      expect(validateUrl('   ')).toEqual({ valid: false, error: 'Please enter a URL' })
    })

    it('returns valid=false for "hello world"', () => {
      const result = validateUrl('hello world')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe("That doesn't look like a valid URL")
    })

    it('returns valid=false for "not-a-url"', () => {
      const result = validateUrl('not-a-url')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe("That doesn't look like a valid URL")
    })

    it('returns valid=false for "example.com" (no protocol)', () => {
      const result = validateUrl('example.com')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe("That doesn't look like a valid URL")
    })
  })

  describe('invalid inputs — disallowed protocols', () => {
    it('returns valid=false for "ftp://example.com"', () => {
      const result = validateUrl('ftp://example.com')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe('Only http and https URLs are supported')
    })

    it('returns valid=false for "javascript:alert(1)"', () => {
      const result = validateUrl('javascript:alert(1)')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe("That URL type isn't supported")
    })

    it('returns valid=false for a data: URL', () => {
      const result = validateUrl('data:text/html,<h1>hi</h1>')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toBe("That URL type isn't supported")
    })
  })
})
