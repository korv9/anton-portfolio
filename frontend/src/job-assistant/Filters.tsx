/**
 * The list tabs with their counts (good fit, saved, applied, closed, all), How it works, and a
 * Filters disclosure with place, role and seniority, each option with the ads it would leave.
 */
import { l } from '../i18n'
import { ROLE_NAMES } from './model'
import {
  DEFAULT_QUERY,
  FACETS,
  LEVELS,
  LISTS,
  isFiltered,
  type Facet,
  type List,
  type Query,
} from './query'

const LIST_NAMES: Record<List, [string, string]> = {
  good: ['Good fit', 'Passar bra'],
  saved: ['Saved', 'Sparade'],
  applied: ['Applied', 'Sökta'],
  closed: ['Closed', 'Stängda'],
  all: ['All', 'Alla'],
}
type Names = Record<string, [string, string]>
const NAMES: Record<
  Facet,
  { label: [string, string]; any: [string, string]; options?: Names }
> = {
  place: {
    label: ['Place', 'Ort'],
    any: ['Anywhere', 'Alla orter'],
    options: { remote: ['Remote mentioned', 'Distans nämns'] },
  },
  role: {
    label: ['Role', 'Roll'],
    any: ['Any role', 'Alla roller'],
    options: ROLE_NAMES,
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
const optionName = (f: Facet, v: string) =>
  l(...(NAMES[f].options?.[v] ?? [v, v]))

type Props = {
  query: Query
  onQuery: (q: Query, push?: boolean) => void
  lists: Record<List, number>
  counts: Record<Facet, Map<string, number>>
  /** The How it works tab is open, so no list is pressed. */
  about: boolean
  onAbout: () => void
}

export default function Filters({
  query,
  onQuery,
  lists,
  counts,
  about,
  onAbout,
}: Props) {
  const set = (f: Facet, v: string) => onQuery({ ...query, [f]: v }, true)
  const active = FACETS.filter((f) => query[f] !== DEFAULT_QUERY[f]).length
  return (
    <div className="ja-lists">
      <nav aria-label={l('Lists', 'Listor')}>
        {LISTS.map((list) => (
          <button
            key={list}
            type="button"
            className="ja-tab"
            aria-pressed={!about && query.list === list}
            onClick={() => onQuery({ ...query, list }, true)}
          >
            {l(...LIST_NAMES[list])}{' '}
            <span className="ja-count" key={lists[list]}>
              {lists[list].toLocaleString()}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="ja-tab"
          aria-pressed={about}
          onClick={onAbout}
        >
          {l('How it works', 'Så fungerar det')}
        </button>
      </nav>
      {!about && (
        <details className="ja-filters" open={active > 0 || undefined}>
          <summary className="ja-label">
            {l('Filters', 'Filter')}
            {active > 0 && ` (${active})`}
          </summary>
          <div>
            {FACETS.map((f) => {
              const c = counts[f]
              const values =
                f === 'level'
                  ? [...LEVELS]
                  : [
                      ...(f === 'place' && c.has('remote') ? ['remote'] : []),
                      ...[...c]
                        .filter(([v]) => v !== 'remote')
                        .sort(
                          (a, b) =>
                            b[1] - a[1] || a[0].localeCompare(b[0], 'sv'),
                        )
                        .map(([v]) => v),
                    ]
              return (
                <label key={f}>
                  <span>{l(...NAMES[f].label)}</span>
                  <select
                    value={query[f]}
                    onChange={(e) => set(f, e.target.value)}
                  >
                    <option value="">{l(...NAMES[f].any)}</option>
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
            {isFiltered(query) && (
              <button
                type="button"
                className="btn-text"
                onClick={() =>
                  onQuery({ ...DEFAULT_QUERY, list: query.list }, true)
                }
              >
                {l('Clear search and filters', 'Rensa sökning och filter')}
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
