/** One ad under review: why it got its class, the evidence on both sides, the full text, the decision. */
import { useState } from 'react'
import { l } from '../i18n'
import {
  LABELS,
  ROLE_NAMES,
  STATUSES,
  write,
  type Judgement,
  type Label,
  type Row,
  type Status,
} from './data'
import { classLabel, cvLevelLabel, day, statusLabel } from './labels'

const ASKS: Record<Judgement['strength'], [string, string]> = {
  required: ['required', 'krav'],
  preferred: ['preferred', 'meriterande'],
  ambiguous: ['mentioned', 'nämns'],
}
const LABEL_NAMES: Record<Label, [string, string]> = {
  relevant: ['Relevant', 'Relevant'],
  maybe: ['Maybe', 'Kanske'],
  not_relevant: ['Not relevant', 'Inte relevant'],
}

type Props = {
  row: Row
  text?: string
  owner: boolean
  storage: boolean
  onSaved: (
    id: string,
    kind: 'review' | 'label',
    value: Record<string, unknown>,
  ) => void
}

/** Keyed by the ad id in the page, so the note, messages and scroll start fresh per ad. */
export default function AdDetail({
  row,
  text,
  owner,
  storage,
  onSaved,
}: Props) {
  const { ad, match } = row
  const [note, setNote] = useState(row.review?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  async function save(
    kind: 'review' | 'label',
    value: Record<string, unknown>,
  ) {
    setError('')
    setDone('')
    setBusy(true)
    try {
      await write(`${kind}s/${ad.id}`, 'PUT', JSON.stringify(value))
      onSaved(ad.id, kind, value)
      setDone(l('Saved.', 'Sparat.'))
    } catch (e) {
      setError(
        l(
          `Not saved: ${(e as Error).message}`,
          `Inte sparat: ${(e as Error).message}`,
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  const setStatus = (status: Status) => save('review', { status, note })
  const place = [ad.municipality, ad.region].filter(Boolean).join(', ')

  return (
    <article className="ja-detail" aria-labelledby="ja-detail-title">
      <header className="ja-detail-head">
        <h2 id="ja-detail-title">{ad.headline}</h2>
        <p className="ja-detail-meta">
          <span className="ja-row-class" data-class={match.class}>
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
            <dt>{l('Changed', 'Ändrad')}</dt>
            <dd>{day(ad.changed)}</dd>
          </div>
          <div>
            <dt>{l('Apply by', 'Sök senast')}</dt>
            <dd>{day(ad.application_deadline)}</dd>
          </div>
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
          <a href={ad.source_url} target="_blank" rel="noreferrer">
            {l('Original ad', 'Originalannonsen')}
          </a>
          {ad.application_url && (
            <a href={ad.application_url} target="_blank" rel="noreferrer">
              {l('Application page', 'Ansökningssidan')}
            </a>
          )}
        </p>
      </header>

      {owner && !storage && (
        <p className="ja-muted">
          {l(
            'The record storage is not set up yet, so statuses and labels cannot be saved.',
            'Lagringen är inte uppsatt än, så status och märkningar kan inte sparas.',
          )}
        </p>
      )}
      {owner && storage && (
        <section
          className="ja-decide"
          aria-label={l('Decision', 'Beslut')}
          aria-busy={busy}
        >
          <div
            className="ja-segment"
            role="group"
            aria-label={l('Status', 'Status')}
          >
            {STATUSES.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={row.status === s}
                disabled={busy}
                onClick={() => setStatus(s)}
                aria-keyshortcuts={String(i + 1)}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
          <label className="ja-note">
            <span>{l('Note', 'Anteckning')}</span>
            <textarea
              rows={2}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() =>
                note !== (row.review?.note ?? '') && setStatus(row.status)
              }
            />
          </label>
          <div
            className="ja-segment"
            role="group"
            aria-label={l('Relevance label', 'Relevansmärkning')}
          >
            {LABELS.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={row.label?.label === x}
                disabled={busy}
                onClick={() =>
                  save('label', {
                    label: x,
                    note: row.label?.note ?? '',
                    shown_class: match.class,
                  })
                }
              >
                {l(...LABEL_NAMES[x])}
              </button>
            ))}
          </div>
          {error && (
            <p className="ja-error" role="alert">
              {error}
            </p>
          )}
          <p className="ja-muted" role="status">
            {done}
          </p>
        </section>
      )}

      <section aria-labelledby="ja-why">
        <h3 id="ja-why">{l('Why this class', 'Varför denna klass')}</h3>
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
                'every quote checked against the ad or the CV.',
                'varje citat kontrollerat mot annonsen eller cv:t.',
              )}
            </small>
          </p>
        )}
      </section>

      {match.skills && match.skills.length > 0 && (
        <section aria-labelledby="ja-evidence">
          <h3 id="ja-evidence">
            {l('Requirements and CV evidence', 'Krav och belägg i cv:t')}
          </h3>
          <div className="ja-table-wrap">
            <table className="ja-table">
              <thead>
                <tr>
                  <th scope="col">{l('Skill', 'Kompetens')}</th>
                  <th scope="col">{l('The ad', 'Annonsen')}</th>
                  <th scope="col">{l('The CV', 'Cv:t')}</th>
                </tr>
              </thead>
              <tbody>
                {match.skills.map((j) => (
                  <tr
                    key={j.skill}
                    data-gap={
                      j.cv_level !== 'practical' &&
                      j.cv_level !== 'education_or_project'
                    }
                  >
                    <th scope="row">
                      {j.skill}
                      <span>{l(...ASKS[j.strength])}</span>
                    </th>
                    <td>
                      <q>{j.ad_quotes[0]?.quote}</q>
                    </td>
                    <td>
                      <strong>{cvLevelLabel(j.cv_level)}</strong>
                      {j.cv_quotes[0] && <q>{j.cv_quotes[0].quote}</q>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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

      <section aria-labelledby="ja-text">
        <h3 id="ja-text">{l('The full ad', 'Hela annonsen')}</h3>
        {text ? (
          <p className="ja-ad-text">{text}</p>
        ) : (
          <p className="ja-muted">
            {l(
              'The text is published for listed, stretch and sampled ads; this one is on the original page.',
              'Texten publiceras för listade, stretch- och urvalsannonser; den här finns på originalsidan.',
            )}
          </p>
        )}
      </section>
    </article>
  )
}
