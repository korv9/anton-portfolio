/** The job board's search field, the filters with a count per option, and the active filters as chips. */
import type { RefObject } from 'react'
import { l } from '../i18n'
import { ROLE_NAMES } from './model'
import {
  DEADLINE,
  DEFAULT_QUERY,
  FACETS,
  LEVELS,
  MATCH_VIEWS,
  PUBLISHED,
  type Facet,
  type Query,
} from './query'

type Names = Record<string, [string, string]>
const NAMES: Record<
  Facet,
  { label: [string, string]; any: [string, string]; options?: Names }
> = {
  match: {
    label: ['Match', 'Matchning'],
    any: ['', ''],
    options: {
      listed: ['Strong and possible', 'Starka och möjliga'],
      strong: ['Strong', 'Starka'],
      possible: ['Possible', 'Möjliga'],
      stretch: ['Stretch', 'Utmaning'],
      outside: ['Outside', 'Utanför'],
      sample: ['Evaluation sample', 'Utvärderingsurval'],
    },
  },
  place: {
    label: ['Place', 'Ort'],
    any: ['Anywhere', 'Alla orter'],
    options: { remote: ['Remote mentioned', 'Distans nämns'] },
  },
  type: {
    label: ['Employment', 'Anställning'],
    any: ['Any type', 'Alla former'],
  },
  role: {
    label: ['Role', 'Roll'],
    any: ['Any role', 'Alla roller'],
    options: ROLE_NAMES,
  },
  published: {
    label: ['Published', 'Publicerad'],
    any: ['Any time', 'När som helst'],
    options: {
      '1': ['Today', 'I dag'],
      '3': ['Last 3 days', 'Senaste 3 dagarna'],
      '7': ['Last 7 days', 'Senaste 7 dagarna'],
      '30': ['Last 30 days', 'Senaste 30 dagarna'],
    },
  },
  deadline: {
    label: ['Apply by', 'Sök senast'],
    any: ['Any deadline', 'Alla sista dagar'],
    options: {
      '7': ['Within 7 days', 'Inom 7 dagar'],
      '14': ['Within 14 days', 'Inom 14 dagar'],
      '30': ['Within 30 days', 'Inom 30 dagar'],
    },
  },
  level: {
    label: ['Seniority', 'Senioritet'],
    any: ['Any level', 'Alla nivåer'],
    options: {
      junior: ['Says junior', 'Nämner junior'],
      not_senior: ['Not senior', 'Inte senior'],
    },
  },
}
/** Closed option lists keep their order; open ones (place, type, role) are listed by count. */
const FIXED: Partial<Record<Facet, readonly string[]>> = {
  match: MATCH_VIEWS,
  published: PUBLISHED,
  deadline: DEADLINE,
  level: LEVELS,
}

export const optionName = (f: Facet, v: string) =>
  l(...(NAMES[f].options?.[v] ?? [v, v]))

type Props = {
  query: Query
  onQuery: (q: Query, push?: boolean) => void
  counts: Record<Facet, Map<string, number>>
  search: RefObject<HTMLInputElement | null>
}

export default function Filters({ query, onQuery, counts, search }: Props) {
  const set = (f: Facet, v: string) => onQuery({ ...query, [f]: v }, true)
  const chips = FACETS.filter((f) => query[f] !== DEFAULT_QUERY[f])
  return (
    <div className="ja-find" role="search">
      <label className="ja-q">
        <span>
          {l('Search jobs', 'Sök jobb')} <kbd>/</kbd>
        </span>
        <input
          ref={search}
          type="search"
          value={query.q}
          placeholder={l(
            'Title, employer or skill, e.g. dbt',
            'Titel, arbetsgivare eller kompetens, t.ex. dbt',
          )}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onQuery({ ...query, q: e.target.value })}
        />
      </label>
      <div className="ja-filters">
        {FACETS.map((f) => {
          const c = counts[f]
          const values = FIXED[f] ?? [
            ...(f === 'place' && c.has('remote') ? ['remote'] : []),
            ...[...c]
              .filter(([v]) => v !== 'remote')
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
              .map(([v]) => v),
          ]
          return (
            <label
              key={f}
              data-active={query[f] !== DEFAULT_QUERY[f] || undefined}
            >
              <span>{l(...NAMES[f].label)}</span>
              <select value={query[f]} onChange={(e) => set(f, e.target.value)}>
                {f !== 'match' && (
                  <option value="">{l(...NAMES[f].any)}</option>
                )}
                {values.map((v) => (
                  <option
                    key={v}
                    value={v}
                    disabled={!c.get(v) && query[f] !== v}
                  >
                    {optionName(f, v)} ({c.get(v) ?? 0})
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      {(chips.length > 0 || query.q.trim()) && (
        <ul
          className="ja-chips"
          aria-label={l('Active filters', 'Aktiva filter')}
        >
          {query.q.trim() && (
            <Chip
              label={l(`Search: ${query.q.trim()}`, `Sök: ${query.q.trim()}`)}
              onRemove={() => onQuery({ ...query, q: '' }, true)}
            />
          )}
          {chips.map((f) => (
            <Chip
              key={f}
              label={optionName(f, query[f])}
              onRemove={() => set(f, DEFAULT_QUERY[f])}
            />
          ))}
          <li>
            <button
              type="button"
              className="btn-text ja-clear"
              onClick={() =>
                onQuery({ ...DEFAULT_QUERY, sort: query.sort }, true)
              }
            >
              {l('Clear filters', 'Rensa filtren')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li>
      <button
        type="button"
        className="ja-chip"
        aria-label={l(`Remove filter ${label}`, `Ta bort filtret ${label}`)}
        onClick={onRemove}
      >
        {label}
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </li>
  )
}
