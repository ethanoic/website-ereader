type ValidateUrlResult = { valid: true; url: string } | { valid: false; error: string }

const UNSAFE_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']
const ALLOWED_PROTOCOLS = ['http:', 'https:']

export function validateUrl(input: string): ValidateUrlResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { valid: false, error: 'Please enter a URL' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL" }
  }

  if (UNSAFE_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, error: "That URL type isn't supported" }
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, error: 'Only http and https URLs are supported' }
  }

  return { valid: true, url: trimmed }
}
