import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { l } from '../i18n'

/** Rebuild only document content as React elements: no scripts, styles or event attributes. */
function documentContent(html: string): ReactNode {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set([
    'p',
    'div',
    'span',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'br',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'sup',
    'sub',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ])
  const render = (node: Node, key: number): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    if (!(node instanceof Element)) return null
    const tag = node.tagName.toLowerCase()
    if (
      [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'link',
        'meta',
        'form',
      ].includes(tag)
    )
      return null
    if (tag === 'img') {
      try {
        const src = new URL(
          node.getAttribute('src') ?? '',
          'https://data.riksdagen.se',
        )
        if (
          src.hostname !== 'data.riksdagen.se' ||
          !src.pathname.startsWith('/fil/')
        )
          return null
        src.protocol = 'https:'
        return (
          <img
            key={key}
            src={src.href}
            loading="lazy"
            alt={
              node.getAttribute('alt') ||
              l('Document appendix', 'Dokumentbilaga')
            }
          />
        )
      } catch {
        return null
      }
    }
    const children = Array.from(node.childNodes).map(render)
    if (!allowed.has(tag)) return createElement('span', { key }, children)
    const props: Record<string, unknown> = { key }
    if (tag === 'td' || tag === 'th') {
      props.colSpan = Math.max(1, Number(node.getAttribute('colspan')) || 1)
      props.rowSpan = Math.max(1, Number(node.getAttribute('rowspan')) || 1)
    }
    return createElement(
      /^h[1-6]$/.test(tag) ? 'h5' : tag,
      props,
      tag === 'br' ? undefined : children,
    )
  }
  return Array.from(doc.body.childNodes).map(render)
}
export default function DocumentReader({
  url,
  title,
}: {
  url: string
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const content = useMemo(() => (text ? documentContent(text) : null), [text])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setText('')
    setError(false)
    let id: string | undefined
    try {
      const source = new URL(url)
      if (
        source.hostname === 'data.riksdagen.se' ||
        source.hostname.endsWith('.riksdagen.se') ||
        source.hostname === 'riksdagen.se'
      ) {
        const tail =
          source.hostname === 'data.riksdagen.se'
            ? (source.pathname.match(/\/dokument\/([^/]+)/i)?.[1] ?? '')
            : (source.pathname.split('/').filter(Boolean).at(-1) ?? '')
        id = tail
          .replace(/\.(text|html|json|pdf)$/i, '')
          .split('_')
          .at(-1)
        if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) id = undefined
      }
    } catch {
      /* Invalid source is handled by the visible error state. */
    }
    if (!id) {
      setError(true)
      return
    }
    fetch(`https://data.riksdagen.se/dokument/${id}/text`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Document unavailable')
        const raw = await response.text()
        const xml = new DOMParser().parseFromString(raw, 'application/xml')
        const html = xml.querySelector('dokument > html')?.textContent
        if (raw.includes('<dokumentstatus') && !html?.trim())
          throw new Error('No document content')
        const body = html || raw
        if (!body.trim()) throw new Error('Empty document')
        if (!controller.signal.aborted) setText(body)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [open, url, attempt])
  return (
    <details
      className="document-reader"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {title} · {l('Read here', 'Läs här')}
      </summary>
      {open && (
        <div>
          {!text && !error && (
            <p role="status">{l('Loading document…', 'Laddar dokument…')}</p>
          )}
          {error && (
            <p role="alert">
              {l(
                'The full text could not be loaded.',
                'Fulltexten kunde inte laddas.',
              )}{' '}
              <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                {l('Try again', 'Försök igen')}
              </button>
            </p>
          )}
          {text && (
            <div className="document-fulltext" lang="sv" tabIndex={0}>
              {content}
            </div>
          )}
          <small>
            <a href={url} target="_blank" rel="noreferrer">
              {l('Original source ↗', 'Originalkälla ↗')}
            </a>
          </small>
        </div>
      )}
    </details>
  )
}
