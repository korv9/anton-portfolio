/** The dense list of ads in the current view; the selected row is marked with aria-current. */
import type { RefObject } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { classLabel, day, statusLabel } from './labels'
import type { Row } from './data'

type Props = {
  route: Route
  shown: Row[]
  selectedId?: string
  /** Shows the status keys in the hint. */
  keys: boolean
  profile: boolean
  listRef: RefObject<HTMLOListElement | null>
  onSelect: (id: string) => void
}

export default function AdList({
  route,
  shown,
  selectedId,
  keys,
  profile,
  listRef,
  onSelect,
}: Props) {
  return (
    <div className="ja-list-pane">
      <p className="ja-list-note" aria-live="polite">
        {shown.length} {l('ads', 'annonser')} · <kbd>j</kbd>/<kbd>k</kbd>{' '}
        {l('to move', 'för att flytta')}
        {keys && (
          <>
            {' '}
            · <kbd>1</kbd>–<kbd>6</kbd> {l('status', 'status')}
          </>
        )}
      </p>
      {shown.length === 0 ? (
        <p className="ja-muted">
          {profile
            ? l('No ad fits this view.', 'Ingen annons passar vyn.')
            : l(
                'Matches appear once a profile is approved.',
                'Matchningar visas när en profil är godkänd.',
              )}
        </p>
      ) : (
        <ol className="ja-list" ref={listRef}>
          {shown.map((r) => (
            <li key={r.ad.id}>
              <a
                href={`${route.path}?${new URLSearchParams({ ...Object.fromEntries(route.params), ad: r.ad.id })}`}
                aria-current={r.ad.id === selectedId ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onSelect(r.ad.id)
                  // Stacked under 760 px the detail sits below the list: bring it up.
                  if (matchMedia('(max-width: 760px)').matches)
                    requestAnimationFrame(() =>
                      document
                        .getElementById('ja-detail-title')
                        ?.scrollIntoView({ block: 'start' }),
                    )
                }}
              >
                <span className="ja-row-class" data-class={r.match.class}>
                  {classLabel(r.match.class)}
                </span>
                <span className="ja-row-title">{r.ad.headline}</span>
                <span className="ja-row-meta">
                  {r.ad.employer} · {r.ad.municipality ?? r.ad.region ?? '–'}
                </span>
                <span className="ja-row-side">
                  {r.status !== 'new' && (
                    <span className="ja-row-status">
                      {statusLabel(r.status)}
                    </span>
                  )}
                  {day(r.ad.published)}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
