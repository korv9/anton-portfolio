/**
 * The Jobs tab before a CV profile is approved: the open ads from ads.json, newest first, with no
 * class or skills, since nothing has been matched (docs/job-assistant.md, What the owner applies).
 */
import { useState } from 'react'
import { l } from '../i18n'
import type { Ad } from './model'
import { ago, left } from './labels'
import { daysBetween } from './query'

const PAGE = 20

export default function Unmatched({ ads, day }: { ads: Ad[]; day: string }) {
  const [n, setN] = useState(PAGE)
  const open = ads.filter((a) => !a.removed_at && !a.expired && !a.duplicate_of)
  return (
    <div className="ja-list-pane">
      <div className="ja-empty">
        <p>
          {l(
            'Matching starts when the CV profile is approved. Until then the list shows the open Data/IT ads as JobTech publishes them, without a match class.',
            'Matchningen börjar när cv-profilen är godkänd. Till dess visar listan de öppna Data/IT-annonserna som JobTech publicerar dem, utan matchningsklass.',
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
