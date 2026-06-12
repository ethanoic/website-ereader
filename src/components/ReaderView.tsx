import { useMemo } from 'react'

interface ReaderViewProps {
  title: string
  byline: string | null
  content: string
}

function wrapTables(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('table').forEach(table => {
    const wrapper = doc.createElement('div')
    wrapper.className = 'overflow-x-auto'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
  return doc.body.innerHTML
}

export function ReaderView({ title, byline, content }: ReaderViewProps) {
  const processedContent = useMemo(() => wrapTables(content), [content])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      {byline && <p className="text-sm text-gray-500 mb-6">{byline}</p>}
      <div
        className="prose max-w-none prose-img:max-w-full"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    </div>
  )
}
