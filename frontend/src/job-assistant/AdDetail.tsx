/** One ad under review: why it got its class, the evidence on both sides, the full text, the decision. */
import { useState, type MutableRefObject } from 'react'
import { l } from '../i18n'
import {
  https,
  recordsNote,
  ROLE_NAMES,
  type Records,
  type Row,
  type Status,
} from './data'
import Decision, { type Saved } from './Decision'
import Evidence from './Evidence'
import { classLabel, day, left, statusLabel } from './labels'
import { daysBetween } from './query'
import Trace from './Trace'
import { useAdText } from './useJobData'

// Python's str.splitlines() breaks, so line numbers match platform/publish/job_content.py.
const LINE_BREAK = /\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/

type Props = {
  row: Row
  /** The text from texts.json; any other ad's text is loaded when it is opened. */
  published?: string
  /** The reader opened this ad (not only shown first), so a missing text may be fetched. */
  opened: boolean
  owner: boolean
  storage: boolean
  /** Why the owner's records could not be read, when they could not. */
  problem?: Records['problem']
  onSaved: Saved
  statusKey: MutableRefObject<((status: Status) => void) | null>
  /** Today in Stockholm, for the deadline countdown. */
  today: string
  /** Back to the list; the button shows only where the detail replaces the list (mobile). */
  onBack: () => void
}

/** Keyed by the ad id in the page, so the note, messages and scroll start fresh per ad. */
export default function AdDetail({
  row,
  published,
  opened,
  owner,
  storage,
  problem,
  onSaved,
  statusKey,
  today,
  onBack,
}: Props) {
  const { ad, match } = row
  const source = https(ad.source_url)
  const apply = https(ad.application_url)
  const [asked, setAsked] = useState(false)
  const load = opened || asked
  const { text, loading, failed } = useAdText(ad.id, published, load)
  const [hit, setHit] = useState<number | null>(null)
  const showLine = (line: number) => {
    setHit(line)
    const target = document.getElementById(`ja-line-${line}`)
    target?.scrollIntoView({ block: 'center' })
    // Focus follows, so keyboard and screen-reader users land on the line too.
    target?.focus({ preventScroll: true })
  }
  const place = [ad.municipality, ad.region].filter(Boolean).join(', ')

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
        {l('Back to the jobs', 'Tillbaka till jobben')}
      </button>
      <header className="ja-detail-head">
        <h2 id="ja-detail-title">{ad.headline}</h2>
        <p className="ja-detail-meta">
          <span className="ja-badge" data-class={match.class}>
            {classLabel(match.class)}
            {match.sample &&
              ` · ${l('evaluation sample', 'utvärderingsurval')}`}
          </span>{' '}
          {ad.employer}
          {place && ` · ${place}`} ·{' '}
          {l(...(ROLE_NAMES[match.role] ?? ROLE_NAMES.other))}
        </p>
        <dl className="ja-dates">
          <div>
            <dt>{l('Published', 'Publicerad')}</dt>
            <dd>{day(ad.published)}</dd>
          </div>
          <div>
            <dt>{l('Apply by', 'Sök senast')}</dt>
            <dd>
              {day(ad.application_deadline)}
              {ad.application_deadline && (
                <small>
                  {' '}
                  {left(daysBetween(today, ad.application_deadline))}
                </small>
              )}
            </dd>
          </div>
          {ad.employment_type && (
            <div>
              <dt>{l('Employment', 'Anställning')}</dt>
              <dd>{ad.employment_type}</dd>
            </div>
          )}
          {ad.working_hours && (
            <div>
              <dt>{l('Hours', 'Omfattning')}</dt>
              <dd>{ad.working_hours}</dd>
            </div>
          )}
          {match.remote && (
            <div>
              <dt>{l('Remote', 'Distans')}</dt>
              <dd>
                <q>{match.remote}</q>
              </dd>
            </div>
          )}
          <div>
            <dt>{l('Status', 'Status')}</dt>
            <dd>
              {statusLabel(row.status)}
              {ad.removed_at &&
                ` · ${l('removed', 'borttagen')} ${day(ad.removed_at)}`}
            </dd>
          </div>
        </dl>
        <p className="ja-links">
          {source && (
            <a href={source} target="_blank" rel="noreferrer">
              {l('Original ad', 'Originalannonsen')}
            </a>
          )}
          {apply && (
            <a href={apply} target="_blank" rel="noreferrer">
              {l('Application page', 'Ansökningssidan')}
            </a>
          )}
        </p>
      </header>

      {owner && problem && (
        <p className="ja-muted" role="status">
          {l(...recordsNote(problem))}
        </p>
      )}
      {owner && storage && (
        <Decision row={row} onSaved={onSaved} statusKey={statusKey} />
      )}

      <section aria-labelledby="ja-why">
        <h3 id="ja-why">{l('Why it matches', 'Varför den matchar')}</h3>
        <ul className="ja-reasons">
          {match.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {match.explanation && (
          <p className="ja-explanation">
            {match.explanation}{' '}
            <small>
              {l('Written by', 'Skrivet av')} {match.explanation_model};{' '}
              {l(
                'every sentence quotes the ad or the CV, and every quote was checked there.',
                'varje mening citerar annonsen eller cv:t, och varje citat är kontrollerat där.',
              )}
            </small>
          </p>
        )}
      </section>

      {match.skills && match.skills.length > 0 && (
        <Evidence skills={match.skills} onLine={text ? showLine : undefined} />
      )}

      {((match.gaps?.length ?? 0) > 0 ||
        (match.checks?.length ?? 0) > 0 ||
        (match.uncertain?.length ?? 0) > 0) && (
        <section aria-labelledby="ja-gaps">
          <h3 id="ja-gaps">
            {l('Gaps and things to check', 'Luckor och saker att kontrollera')}
          </h3>
          {match.gaps && match.gaps.length > 0 && (
            <p>
              {l(
                'Not shown in work or projects: ',
                'Inte visat i arbete eller projekt: ',
              )}
              {match.gaps.join(', ')}.
            </p>
          )}
          <ul className="ja-reasons">
            {match.checks?.map((c) => (
              <li key={c.kind + c.quote}>
                {c.kind === 'education'
                  ? l('Education', 'Utbildning')
                  : l('Condition', 'Villkor')}
                : <q>{c.quote}</q>
              </li>
            ))}
            {match.uncertain?.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      <Trace />

      <section aria-labelledby="ja-text">
        <h3 id="ja-text">{l('The full ad', 'Hela annonsen')}</h3>
        {text ? (
          <p className="ja-ad-text">
            {text.split(LINE_BREAK).map((line, i) => (
              <span
                key={i}
                id={`ja-line-${i + 1}`}
                tabIndex={-1}
                data-hit={hit === i + 1 || undefined}
              >
                {line}
                {'\n'}
              </span>
            ))}
          </p>
        ) : loading ? (
          <p className="ja-muted" role="status">
            {l('Loading the full text…', 'Laddar hela texten…')}
          </p>
        ) : !load ? (
          <p className="ja-muted">
            <button
              type="button"
              className="btn-quiet"
              onClick={() => setAsked(true)}
            >
              {l('Load the full text', 'Ladda hela texten')}
            </button>
          </p>
        ) : (
          <p className="ja-muted">
            {failed &&
              l(
                'The full text of this ad could not be loaded. ',
                'Hela texten för den här annonsen gick inte att läsa. ',
              )}
            {source && (
              <a href={source} target="_blank" rel="noreferrer">
                {l('Read it on Platsbanken', 'Läs den på Platsbanken')}
              </a>
            )}
          </p>
        )}
      </section>
    </article>
  )
}
