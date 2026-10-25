/**
 * The Jobs tab when nothing is matched: the open ads from ads.json, newest first, with no class or
 * skills, under the reason rank.py recorded (no approved profile, or a route it could not read).
 */
import { useState } from 'react'
import { l } from '../i18n'
import { unmatchedNote, type Ad, type RouteNote } from './model'
import { ago, left } from './labels'
import { daysBetween } from './query'

const PAGE = 20

type Props = { ads: Ad[]; day: string; skipped?: RouteNote }

export default function Unmatched({ ads, day, skipped }: Props) {
  const [n, setN] = useState(PAGE)
  const note = unmatchedNote(skipped)
  const open = ads.filter((a) => !a.removed_at && !a.expired && !a.duplicate_of)
  return (
    <div className="ja-list-pane">
      <div className="ja-empty">
        <p>
          {l(...note)}{' '}
          {l(
            'The list shows the open Data/IT ads as JobTech publishes them, without a match class.',
            'Listan visar de öppna Data/IT-annonserna som JobTech publicerar dem, utan matchningsklass.',
          )}
        </p>
      </div>
      <p className="ja-results-head" aria-live="polite">
        <strong>{open.length.toLocaleString()}</strong>{' '}
        {l('open ads', 'öppna annonser')}
      </p>
      <ol className="ja-cards">
        {open.slice(0, n).map((ad) => {
          const deadline = daysBetween(day, ad.application_deadline)
          return (
            <li key={ad.id}>
              <a className="ja-card" href={ad.source_url} rel="noopener">
                <span className="ja-card-title">{ad.headline}</span>
                <span className="ja-card-employer">
                  {ad.employer}
                  {(ad.municipality ?? ad.region) &&
                    ` · ${ad.municipality ?? ad.region}`}
                </span>
                <span className="ja-card-meta">
                  <span>{ago(daysBetween(ad.published, day))}</span>
                  {deadline != null && <span>{left(deadline)}</span>}
                  {ad.employment_type && <span>{ad.employment_type}</span>}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
      {n < open.length && (
        <button
          type="button"
          className="btn-quiet ja-more"
          onClick={() => setN(n + PAGE)}
        >
          {l(
            `Show more (${n} of ${open.length})`,
            `Visa fler (${n} av ${open.length})`,
          )}
        </button>
      )}
    </div>
  )
}
