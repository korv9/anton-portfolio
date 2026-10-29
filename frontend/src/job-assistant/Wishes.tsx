/**
 * The owner's wishes in the profile draft: roles in order of preference, places, remote and
 * seniority. Edits the draft's `wishes` only; the hourly run applies them once the draft is
 * approved (platform/job_assistant/cv_profile.py checks the keys).
 */
import { useState } from 'react'
import { l } from '../i18n'
import { ROLE_NAMES } from './model'

export type WishSet = {
  roles: string[]
  locations: string[]
  remote: string | null
  interests: string[]
  /** "junior" (the default when absent) or "any". */
  seniority?: 'junior' | 'any'
}
type Props = { wishes: WishSet; onChange: (w: WishSet) => void }

const REMOTE: [string, string, string][] = [
  ['', 'No preference', 'Ingen preferens'],
  ['no', 'On site', 'På plats'],
  ['hybrid', 'Hybrid', 'Hybrid'],
  ['remote', 'Remote', 'Distans'],
]
const roleName = (r: string) => l(...(ROLE_NAMES[r] ?? [r, r]))
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export default function Wishes({ wishes, onChange }: Props) {
  // The places as typed; reset only when the JSON beside it changes them.
  const joined = wishes.locations.join(', ')
  const [places, setPlaces] = useState(joined)
  const [seen, setSeen] = useState(joined)
  if (seen !== joined) {
    setSeen(joined)
    setPlaces(joined)
  }
  const set = (w: Partial<WishSet>) => onChange({ ...wishes, ...w })
  const roles = wishes.roles
  const move = (i: number, by: number) => {
    const next = [...roles]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    set({ roles: next })
  }
  const unused = Object.keys(ROLE_NAMES).filter((r) => !roles.includes(r))

  return (
    <fieldset className="ja-wishes">
      <legend>{l('Wishes', 'Önskemål')}</legend>
      <p className="ja-muted">
        {l(
          'Changes apply after approval, at the next run.',
          'Ändringar gäller efter godkännandet, vid nästa körning.',
        )}
      </p>
      <div>
        <span id="ja-wish-roles" className="ja-muted">
          {l('Roles, most wanted first', 'Roller, mest önskad först')}
        </span>
        <ol className="ja-wish-roles" aria-labelledby="ja-wish-roles">
          {roles.map((r, i) => (
            <li key={r}>
              <span>{roleName(r)}</span>
              <button
                type="button"
                className="btn-text"
                disabled={i === 0}
                aria-label={l(
                  `Move ${roleName(r)} up`,
                  `Flytta upp ${roleName(r)}`,
                )}
                onClick={() => move(i, -1)}
              >
                {l('Up', 'Upp')}
              </button>
              <button
                type="button"
                className="btn-text"
                disabled={i === roles.length - 1}
                aria-label={l(
                  `Move ${roleName(r)} down`,
                  `Flytta ner ${roleName(r)}`,
                )}
                onClick={() => move(i, 1)}
              >
                {l('Down', 'Ner')}
              </button>
              <button
                type="button"
                className="btn-text"
                aria-label={l(
                  `Remove ${roleName(r)}`,
                  `Ta bort ${roleName(r)}`,
                )}
                onClick={() => set({ roles: roles.filter((x) => x !== r) })}
              >
                {l('Remove', 'Ta bort')}
              </button>
            </li>
          ))}
        </ol>
        {unused.length > 0 && (
          <label>
            <span>{l('Add a role', 'Lägg till en roll')}</span>
            <select
              value=""
              onChange={(e) =>
                e.target.value && set({ roles: [...roles, e.target.value] })
              }
            >
              <option value="">–</option>
              {unused.map((r) => (
                <option key={r} value={r}>
                  {roleName(r)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        <span>{l('Places, comma separated', 'Orter, kommaseparerade')}</span>
        <input
          value={places}
          onChange={(e) => {
            const next = list(e.target.value)
            setPlaces(e.target.value)
            setSeen(next.join(', '))
            set({ locations: next })
          }}
        />
      </label>
      <label>
        <span>{l('Remote', 'Distans')}</span>
        <select
          value={wishes.remote ?? ''}
          onChange={(e) => set({ remote: e.target.value || null })}
        >
          {REMOTE.map(([v, en, sv]) => (
            <option key={v} value={v}>
              {l(en, sv)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{l('Seniority', 'Senioritet')}</span>
        <select
          value={wishes.seniority ?? 'junior'}
          onChange={(e) =>
            set({ seniority: e.target.value as WishSet['seniority'] })
          }
        >
          <option value="junior">
            {l(
              'Junior: a senior ad is at most a stretch',
              'Junior: en senior annons blir högst en utmaning',
            )}
          </option>
          <option value="any">{l('Any level', 'Alla nivåer')}</option>
        </select>
      </label>
    </fieldset>
  )
}
