/**
 * The paragraphs a turn was answered from (Thread.tsx): folded under the turn on a narrow screen,
 * and on a wide one in a panel beside the conversation (SourcePanel), where a quote's id leads.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Hit } from './Thread'

const WIDE = '(min-width: 1100px)'

/** Whether the screen is wide enough for the sources panel. */
export function useWide() {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches)
  useEffect(() => {
    const query = matchMedia(WIDE)
    const change = () => setWide(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return wide
}

/** Passages shown before "Show all". */
const FIRST = 3

export const anchor = (turn: number, id: string) => `lq-${turn}-${id}`

export function Sources({
  turn,
  hits,
  lang,
  all,
  onAll,
}: {
  turn: number
  hits: Hit[]
  lang?: string
  all: boolean
  onAll: () => void
}) {
  return (
    <>
      <ol className="lq-passages">
        {hits.map(({ item }, i) => (
          <li
            key={item.id}
            id={anchor(turn, item.id)}
            lang={lang}
            tabIndex={-1}
            hidden={!all && i >= FIRST}
          >
            <p className="lq-title">
              <a href={item.url}>{item.title}</a>{' '}
              <small translate="no">{item.id}</small>
            </p>
            {item.text.split(/\n\n+/).map((part, n) => (
              <p key={n}>{part}</p>
            ))}
          </li>
        ))}
      </ol>
      {!all && hits.length > FIRST && (
        <button type="button" className="btn-text lq-more" onClick={onAll}>
          {l(`Show all ${hits.length}`, `Visa alla ${hits.length}`)}
        </button>
      )}
    </>
  )
}

/** The panel beside the conversation: one turn's sources, the passage a quote named in focus. */
export function SourcePanel({
  turn,
  question,
  hits,
  lang,
  target,
}: {
  turn: number
  question: string
  hits: Hit[] | null
  lang?: string
  target: string | null
}) {
  const [all, setAll] = useState(false)
  useEffect(() => {
    if (!target) return
    setAll(true)
    // After the render that shows every passage.
    requestAnimationFrame(() =>
      document.getElementById(anchor(turn, target))?.focus(),
    )
  }, [turn, target])
  return (
    <aside className="lq-panel" aria-label={l('Sources', 'Källor')}>
      <h2 className="lq-law-title">{l('Sources', 'Källor')}</h2>
      <p className="lq-caption">{question}</p>
      {hits ? (
        <Sources
          turn={turn}
          hits={hits}
          lang={lang}
          all={all}
          onAll={() => setAll(true)}
        />
      ) : (
        <p className="lq-status lq-loading">
          {l('Searching the law…', 'Söker i lagen…')}
        </p>
      )}
    </aside>
  )
}
