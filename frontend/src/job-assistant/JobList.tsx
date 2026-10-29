/** The left column: one compact line per ad (title, employer, place, mark, days left), in pages. */
import type { CSSProperties, RefObject } from 'react'
import { l } from '../i18n'
import type { Row } from './model'
import { markLabel } from './labels'
import { daysBetween } from './query'

type Props = {
  rows: Row[]
  total: number
  selectedId?: string
  href: (id: string) => string
  onOpen: (id: string) => void
  onMore: () => void
  empty: string
  day: string
  listRef: RefObject<HTMLOListElement | null>
  /** The list, search and filters: a change re-mounts the list, so its items fade in once. */
  listKey: string
}

export default function JobList(p: Props) {
  return (
    <div className="ja-list-pane">
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {p.total === 1
          ? l('1 job', '1 jobb')
          : l(`${p.total} jobs`, `${p.total} jobb`)}
      </p>
      {p.total === 0 ? (
        <p className="ja-empty">{p.empty}</p>
      ) : (
        <ol className="ja-items" ref={p.listRef} key={p.listKey}>
          {p.rows.map((r, i) => (
            <li key={r.ad.id} style={{ '--i': i } as CSSProperties}>
              <Item
                row={r}
                day={p.day}
                href={p.href(r.ad.id)}
                current={r.ad.id === p.selectedId}
                onOpen={p.onOpen}
              />
            </li>
          ))}
        </ol>
      )}
      {p.rows.length < p.total && (
        <button type="button" className="btn-quiet ja-more" onClick={p.onMore}>
          {l(
            `Show more (${p.rows.length} of ${p.total})`,
            `Visa fler (${p.rows.length} av ${p.total})`,
          )}
        </button>
      )}
    </div>
  )
}

type ItemProps = {
  row: Row
  day: string
  href: string
  current: boolean
  onOpen: (id: string) => void
}

function Item({ row: { ad, mine }, day, href, current, onOpen }: ItemProps) {
  const days = daysBetween(day, ad.application_deadline)
  const place =
    ad.municipality ?? ad.region ?? l('place not stated', 'ort ej angiven')
  return (
    <a
      className="ja-item"
      href={href}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onOpen(ad.id)
      }}
    >
      <span className="ja-item-title">{ad.headline}</span>
      <span
        className="ja-item-days"
        data-soon={days != null && days >= 0 && days < 7 ? '' : undefined}
      >
        {days != null && days >= 0 ? (
          <>
            {days}
            <span aria-hidden="true">d</span>
            <span className="visually-hidden">
              {l(' days left', ' dagar kvar')}
            </span>
          </>
        ) : (
          <span aria-hidden="true">–</span>
        )}
      </span>
      <span className="ja-item-sub">
        {ad.employer} · {place}
        {mine && (
          <>
            {' · '}
            <span className="ja-mark" data-mark={mine}>
              {markLabel(mine)}
            </span>
          </>
        )}
      </span>
    </a>
  )
}
