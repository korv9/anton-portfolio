/** The review list's views, filters, sort and search. */
import type { RefObject } from 'react'
import { l } from '../i18n'
import { statusLabel } from './labels'
import {
  ROLE_NAMES,
  STATUSES,
  type MatchClass,
  type Row,
  type View,
} from './data'

export const VIEWS: {
  id: string
  classes: View['classes']
  en: string
  sv: string
}[] = [
  {
    id: 'list',
    classes: ['strong', 'possible'],
    en: 'Review list',
    sv: 'Granskningslistan',
  },
  { id: 'stretch', classes: ['stretch'], en: 'Stretch', sv: 'Utmaning' },
  { id: 'outside', classes: ['outside'], en: 'Outside', sv: 'Utanför' },
  {
    id: 'sample',
    classes: 'sample',
    en: 'Evaluation sample',
    sv: 'Utvärderingsurval',
  },
]

type Props = {
  all: Row[]
  viewId: string
  onView: (id: string) => void
  view: View
  setView: (view: View) => void
  roles: string[]
  search: RefObject<HTMLInputElement | null>
}

export default function Toolbar({
  all,
  viewId,
  onView,
  view,
  setView,
  roles,
  search,
}: Props) {
  return (
    <div className="ja-toolbar" role="search">
      <div
        className="ja-segment"
        role="group"
        aria-label={l('Which ads', 'Vilka annonser')}
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={viewId === v.id}
            onClick={() => onView(v.id)}
          >
            {l(v.en, v.sv)}
            <span className="ja-count">
              {
                all.filter((r) =>
                  v.classes === 'sample'
                    ? r.match.sample
                    : v.classes.includes(r.match.class as MatchClass),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <label>
        <span>{l('Status', 'Status')}</span>
        <select
          value={view.status}
          onChange={(e) =>
            setView({ ...view, status: e.target.value as View['status'] })
          }
        >
          <option value="all">{l('Any', 'Alla')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{l('Role', 'Roll')}</span>
        <select
          value={view.role}
          onChange={(e) => setView({ ...view, role: e.target.value })}
        >
          <option value="all">{l('Any', 'Alla')}</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {l(...(ROLE_NAMES[r] ?? [r, r]))}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{l('Sort', 'Sortera')}</span>
        <select
          value={view.sort}
          onChange={(e) =>
            setView({ ...view, sort: e.target.value as View['sort'] })
          }
        >
          <option value="rank">{l('Best match', 'Bäst matchning')}</option>
          <option value="newest">{l('Newest', 'Nyast')}</option>
          <option value="deadline">{l('Deadline', 'Sista dag')}</option>
        </select>
      </label>
      <label className="ja-search">
        <span>
          {l('Search', 'Sök')} <kbd>/</kbd>
        </span>
        <input
          ref={search}
          type="search"
          value={view.q}
          placeholder={l('Title, employer, place', 'Titel, arbetsgivare, ort')}
          onChange={(e) => setView({ ...view, q: e.target.value })}
        />
      </label>
    </div>
  )
}
