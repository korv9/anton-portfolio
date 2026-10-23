/** The results: a count and the sort, one card per ad, and "show more" instead of endless scroll. */
import type { RefObject } from 'react'
import { l } from '../i18n'
import type { Row } from './model'
import { ago, classLabel, left, statusLabel } from './labels'
import { daysBetween, SORTS, type Query } from './query'

const SORT_NAMES: Record<Query['sort'], [string, string]> = {
  rank: ['Best match', 'Bäst matchning'],
  newest: ['Newest', 'Nyast'],
  deadline: ['Deadline soonest', 'Sista dag först'],
}
const SHOWN_SKILLS = 4
const SHOWN_GAPS = 2
const shownInCv = (level: string | null) =>
  level === 'practical' || level === 'education_or_project'

type Props = {
  rows: Row[]
  total: number
  query: Query
  onQuery: (q: Query, push?: boolean) => void
  selectedId?: string
  href: (id: string) => string
  onOpen: (id: string) => void
  onMore: () => void
  onClear: () => void
  filtered: boolean
  profile: boolean
  day: string
  listRef: RefObject<HTMLOListElement | null>
}

export default function AdList(p: Props) {
  return (
    <div className="ja-list-pane">
      <div className="ja-results-head">
        <p aria-live="polite" aria-atomic="true">
          <strong>{p.total.toLocaleString()}</strong>{' '}
          {p.total === 1 ? l('job', 'jobb') : l('jobs', 'jobb')}
        </p>
        <label>
          <span>{l('Sort', 'Sortera')}</span>
          <select
            value={p.query.sort}
            onChange={(e) =>
              p.onQuery(
                { ...p.query, sort: e.target.value as Query['sort'] },
                true,
              )
            }
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {l(...SORT_NAMES[s])}
              </option>
            ))}
          </select>
        </label>
      </div>
      {p.total === 0 ? (
        <div className="ja-empty">
          <p>
            {!p.profile
              ? l(
                  'Matches appear once a CV profile is approved.',
                  'Matchningar visas när en cv-profil är godkänd.',
                )
              : p.filtered
                ? l('No job fits these filters.', 'Inget jobb passar filtren.')
                : l(
                    'No job in this view right now.',
                    'Inget jobb i vyn just nu.',
                  )}
          </p>
          {p.filtered && (
            <button type="button" className="btn-quiet" onClick={p.onClear}>
              {l('Clear filters', 'Rensa filtren')}
            </button>
          )}
        </div>
      ) : (
        <ol className="ja-cards" ref={p.listRef}>
          {p.rows.map((r) => (
            <li key={r.ad.id}>
              <Card
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

type CardProps = {
  row: Row
  day: string
  href: string
  current: boolean
  onOpen: (id: string) => void
}

function Card({
  row: { ad, match, status },
  day,
  href,
  current,
  onOpen,
}: CardProps) {
  const skills = match.skills ?? []
  const has = skills.filter((j) => shownInCv(j.cv_level)).slice(0, SHOWN_SKILLS)
  const gaps = skills
    .filter((j) => !shownInCv(j.cv_level) && j.strength !== 'ambiguous')
    .slice(0, SHOWN_GAPS)
  const deadline = daysBetween(day, ad.application_deadline)
  return (
    <a
      className="ja-card"
      href={href}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onOpen(ad.id)
      }}
    >
      <span className="ja-card-top">
        <span className="ja-badge" data-class={match.class}>
          {classLabel(match.class)}
        </span>
        {status !== 'new' && (
          <span className="ja-status">{statusLabel(status)}</span>
        )}
        {match.remote && (
          <span className="ja-tag">{l('Remote', 'Distans')}</span>
        )}
      </span>
      <span className="ja-card-title">{ad.headline}</span>
      <span className="ja-card-employer">
        {ad.employer}
        {(ad.municipality ?? ad.region) && ` · ${ad.municipality ?? ad.region}`}
      </span>
      <span className="ja-card-meta">
        <span>{ago(daysBetween(ad.published, day))}</span>
        {deadline != null && (
          <span data-soon={deadline >= 0 && deadline <= 7 ? '' : undefined}>
            {left(deadline)}
          </span>
        )}
        {ad.employment_type && <span>{ad.employment_type}</span>}
      </span>
      {(has.length > 0 || gaps.length > 0) && (
        <span className="ja-skills">
          {has.map((j) => (
            <span key={j.skill} className="ja-skill">
              {j.skill}
            </span>
          ))}
          {gaps.map((j) => (
            <span key={j.skill} className="ja-skill" data-gap="">
              <span className="visually-hidden">
                {l('missing: ', 'saknas: ')}
              </span>
              {j.skill}
            </span>
          ))}
        </span>
      )}
    </a>
  )
}
