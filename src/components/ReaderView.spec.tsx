import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReaderView } from './ReaderView'

const FULL_PROPS = {
  title: 'Test Article Title',
  byline: 'By Jane Doe',
  content: [
    '<p>Article content here.</p>',
    '<img src="https://example.com/photo.jpg" alt="photo" />',
    '<a href="https://example.com">a link</a>',
    '<pre><code>const x = 1;</code></pre>',
    '<table><thead><tr><th>Col</th></tr></thead>',
    '<tbody><tr><td>data</td></tr></tbody></table>',
  ].join(''),
}

describe('<ReaderView />', () => {
  describe('structure', () => {
    it('renders the article title in an <h1>', () => {
      render(<ReaderView {...FULL_PROPS} />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Test Article Title' }),
      ).toBeInTheDocument()
    })

    it('renders byline in a <p> when byline prop is a string', () => {
      render(<ReaderView {...FULL_PROPS} />)
      expect(screen.getByText('By Jane Doe')).toBeInTheDocument()
    })

    it('does not render a byline element when byline prop is null', () => {
      render(<ReaderView {...FULL_PROPS} byline={null} />)
      expect(screen.queryByText('By Jane Doe')).not.toBeInTheDocument()
    })

    it('renders article content via dangerouslySetInnerHTML', () => {
      render(<ReaderView {...FULL_PROPS} />)
      expect(screen.getByText('Article content here.')).toBeInTheDocument()
    })
  })

  describe('Tailwind / layout classes', () => {
    it('article content container has the "prose" class', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} />)
      expect(container.querySelector('.prose')).toBeInTheDocument()
    })

    it('article content container has "max-w-none" to fill the mobile viewport', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} />)
      expect(container.querySelector('.max-w-none')).toBeInTheDocument()
    })

    it('article content container has "prose-img:max-w-full" constraint', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} />)
      const proseEl = container.querySelector('.prose')
      expect(proseEl?.className).toContain('prose-img:max-w-full')
    })

    it('tables are wrapped in a div with "overflow-x-auto" class', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} />)
      expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument()
    })
  })

  describe('snapshots', () => {
    it('matches snapshot for a full article (title + byline + mixed content)', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} />)
      expect(container).toMatchSnapshot()
    })

    it('matches snapshot for an article with no byline', () => {
      const { container } = render(<ReaderView {...FULL_PROPS} byline={null} />)
      expect(container).toMatchSnapshot()
    })
  })
})
