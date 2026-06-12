import { useState, type ChangeEvent, type FormEvent } from 'react'
import { validateUrl } from '../lib/validateUrl'

interface UrlInputProps {
  onSubmit: (url: string) => void
  loading: boolean
  error?: string
}

export function UrlInput({ onSubmit, loading, error }: UrlInputProps) {
  const [value, setValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    if (validationError) setValidationError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateUrl(value)
    if (!result.valid) {
      setValidationError(result.error)
      return
    }
    setValidationError(null)
    onSubmit(result.url)
  }

  const shownError = validationError ?? error

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="url" className="sr-only">
        Article URL
      </label>
      <input
        id="url"
        name="url"
        type="text"
        inputMode="url"
        autoComplete="url"
        placeholder="Paste an article URL…"
        value={value}
        onChange={handleChange}
        disabled={loading}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? 'url-error' : undefined}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-3 text-base font-medium text-white disabled:bg-gray-400"
      >
        {loading ? 'Reading…' : 'Read'}
      </button>
      {shownError && (
        <p id="url-error" role="alert" className="text-sm text-red-600">
          {shownError}
        </p>
      )}
    </form>
  )
}
