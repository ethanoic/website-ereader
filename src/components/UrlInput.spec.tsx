import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UrlInput } from './UrlInput'

describe('<UrlInput />', () => {
  describe('submission', () => {
    it('calls onSubmit with the validated URL when input is valid', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<UrlInput onSubmit={onSubmit} loading={false} />)

      await user.type(screen.getByRole('textbox'), 'https://example.com/article')
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith('https://example.com/article')
    })

    it('trims whitespace via validateUrl before calling onSubmit', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<UrlInput onSubmit={onSubmit} loading={false} />)

      await user.type(screen.getByRole('textbox'), '  https://example.com  ')
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(onSubmit).toHaveBeenCalledWith('https://example.com')
    })

    it('does not call onSubmit when the URL is invalid', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<UrlInput onSubmit={onSubmit} loading={false} />)

      await user.type(screen.getByRole('textbox'), 'not a url')
      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('validation errors', () => {
    it('shows an inline error from validateUrl on submit', async () => {
      const user = userEvent.setup()
      render(<UrlInput onSubmit={vi.fn()} loading={false} />)

      await user.click(screen.getByRole('button', { name: 'Read' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a URL')
    })

    it('does not validate on keystroke (only on submit)', async () => {
      const user = userEvent.setup()
      render(<UrlInput onSubmit={vi.fn()} loading={false} />)

      await user.type(screen.getByRole('textbox'), 'bad')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('clears the validation error when the user modifies the input', async () => {
      const user = userEvent.setup()
      render(<UrlInput onSubmit={vi.fn()} loading={false} />)

      await user.click(screen.getByRole('button', { name: 'Read' }))
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await user.type(screen.getByRole('textbox'), 'h')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('displays the error prop passed from the parent', () => {
      render(
        <UrlInput onSubmit={vi.fn()} loading={false} error="The proxy couldn't reach that page" />,
      )
      expect(screen.getByRole('alert')).toHaveTextContent("The proxy couldn't reach that page")
    })
  })

  describe('loading state', () => {
    it('disables the input while loading', () => {
      render(<UrlInput onSubmit={vi.fn()} loading={true} />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('disables the button while loading', () => {
      render(<UrlInput onSubmit={vi.fn()} loading={true} />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('shows a loading affordance on the button while loading', () => {
      render(<UrlInput onSubmit={vi.fn()} loading={true} />)
      expect(screen.getByRole('button', { name: 'Reading…' })).toBeInTheDocument()
    })
  })
})
