/**
 * One ad on the desk: title, employer and place, what the ad asks for (skills as tags, grouped
 * as the ad grades them), the ad itself, and an aside of quick facts with the reader's marks
 * (save, applied, close) and the way to apply. No CV comparison here: that is the matching's job.
 */
import { l } from '../i18n'
import { https, type Judgement, type Mine, type Row } from './data'
import AdText from './AdText'
import { day, fitLabel, left } from './labels'
import { daysBetween } from './query'

type Props = {
  row: Row
  published?: string
  opened: boolean
  /** Sets or clears a mark; a pressed button clears its own. */
  onMark: (id: string, mark: Mine | undefined) => void
  /** Where the marks are kept, said quietly under the buttons. */
  kept: string
  today: string
  onBack: () => void
}

const GROUPS: [Judgement['strength'], [string, string]][] = [
  ['required', ['Required', 'Krav']],
  ['preferred', ['Nice to have', 'Meriterande']],
  ['ambiguous', ['Named in the ad', 'Nämns i annonsen']],
]
const MARKS: [Mine, [string, string]][] = [
  ['saved', ['Save', 'Spara']],
  ['applied', ['Mark as applied', 'Markera som sökt']],
  ['closed', ['Close', 'Stäng']],
]

export default function AdDetail({
  row,
  published,
  opened,
  onMark,
  kept,
  today,
  onBack,
}: Props) {
  const { ad, match, mine } = row
  const source = https(ad.source_url)
  const apply = https(ad.application_url) ?? source
  const place = [ad.municipality, ad.region].filter(Boolean).join(', ')
  const days = daysBetween(today, ad.application_deadline)
  const skills = match?.skills ?? []
  const graded = skills.some((s) => s.strength !== 'ambiguous')

  return (
    <article className="ja-detail" aria-labelledby="ja-detail-title">
      <button type="button" className="btn-text ja-back" onClick={onBack}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path
            d="M8 2L4 6l4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {l('Back to the list', 'Tillbaka till listan')}
      </button>
      <div className="ja-detail-main">
        <h2 id="ja-detail-title">{ad.headline}</h2>
        <p className="ja-employer">
          {ad.employer}
          {place && ` · ${place}`}
        </p>

        {skills.length > 0 && (
          <section aria-labelledby="ja-asks">
            <h3 id="ja-asks">
              {l('What the ad asks for', 'Vad annonsen efterfrågar')}
            </h3>
            {GROUPS.map(([strength, name]) => {
              const tags = skills.filter((s) => s.strength === strength)
              if (tags.length === 0) return null
              return (
                <div key={strength} className="ja-tag-group">
                  {(graded || strength !== 'ambiguous') && (
                    <p className="ja-label">{l(...name)}</p>
                  )}
                  <ul className="ja-tags" data-strength={strength}>
                    {tags.map((s) => (
                      <li key={s.skill}>{s.skill}</li>
                    ))}
                  </ul>
                  {strength === 'ambiguous' && (
                    <p className="ja-label">
                      {graded
                        ? l(
                            'The ad does not say whether these are required or nice to have',
                            'Annonsen säger inte om de här är krav eller meriterande',
                          )
                        : l(
                            'The ad does not separate required from nice to have',
                            'Annonsen skiljer inte på krav och meriterande',
                          )}
                    </p>
                  )}
                </div>
              )
            })}
            {match?.checks && match.checks.length > 0 && (
              <p className="ja-checks">
                {l('Education and conditions: ', 'Utbildning och villkor: ')}
                {match.checks.map((c) => c.quote).join(' · ')}
              </p>
            )}
          </section>
        )}

        <AdText
          id={ad.id}
          published={published}
          opened={opened}
          source={source}
        />
      </div>

      <aside className="ja-facts" aria-label={l('Quick facts', 'Snabbfakta')}>
        <dl>
          <div>
            <dt className="ja-label">{l('Apply by', 'Sök senast')}</dt>
            <dd>
              {day(ad.application_deadline)}
              {days != null && ` · ${left(days)}`}
            </dd>
          </div>
          {(ad.employment_type || ad.working_hours) && (
            <div>
              <dt className="ja-label">{l('Employment', 'Anställning')}</dt>
              <dd>
                {[ad.employment_type, ad.working_hours]
                  .filter(Boolean)
                  .join(', ')}
              </dd>
            </div>
          )}
          <div>
            <dt className="ja-label">{l('Published', 'Publicerad')}</dt>
            <dd>{day(ad.published)}</dd>
          </div>
          <div>
            <dt className="ja-label">{l('Fit', 'Passform')}</dt>
            <dd>{fitLabel(match)}</dd>
          </div>
          {ad.removed_at && (
            <div>
              <dt className="ja-label">{l('Removed', 'Borttagen')}</dt>
              <dd>{day(ad.removed_at)}</dd>
            </div>
          )}
        </dl>
        <div className="ja-actions">
          {MARKS.map(([mark, name]) => (
            <button
              key={mark}
              type="button"
              className="btn-quiet"
              aria-pressed={mine === mark}
              onClick={() => onMark(ad.id, mine === mark ? undefined : mark)}
            >
              {l(...name)}
            </button>
          ))}
          <p className="ja-label ja-kept" key={mine ?? 'none'}>
            {kept}
          </p>
          {apply && (
            <a
              className="btn ja-apply"
              href={apply}
              target="_blank"
              rel="noreferrer"
            >
              {l('Apply at the employer', 'Sök hos arbetsgivaren')}
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M7 17L17 7M9 7h8v8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </a>
          )}
        </div>
      </aside>
    </article>
  )
}
