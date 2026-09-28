import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import { load, percent, type StudyLink } from './data'

type Bill = {
  bill: string
  title: string
  bill_date: string | null
  url: string
  decided: string | null
}
type Study = {
  key: string
  kind: StudyLink['kind']
  designation: string
  title: string
  inquiry: string | null
  published: string
  url: string
  bills: Bill[]
}
type Law = {
  bill: string
  title: string
  department: string | null
  url: string
  decided: string
  studies: StudyLink[]
}
type StudiesData = {
  generated_at: string
  latest: Study[]
  per_year: { year: number; kind: string; published: number; cited: number }[]
  recent_laws: Law[]
  kinds: Record<string, [string, string]>
  method: string
}

const day = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '–'

/** The studies behind a decision, as short links: "SOU 2025:95 Title". */
export function StudyLinks({ studies }: { studies?: StudyLink[] }) {
  if (!studies?.length) return null
  return (
    <p className="study-links">
      <span>{l('Based on', 'Bygger på')}:</span>{' '}
      {studies.map((s, index) => (
        <span key={s.designation}>
          {index > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.kind === 'pm' ? l('Memorandum', 'Promemoria') : s.designation}
          </a>
          {s.title && s.kind !== 'pm' ? ` ${s.title}` : ''}
          {s.kind === 'pm' && s.title ? ` ${s.title}` : ''}
        </span>
      ))}
    </p>
  )
}

const KINDS = ['sou', 'ds', 'rir'] as const

/** New government studies, what they led to, and the laws recently decided on them. */
export default function StudiesView() {
  const [data, setData] = useState<StudiesData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(40)

  useEffect(() => {
    load<StudiesData>('parliament/studies.json')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLowerCase()
    return data.latest.filter(
      (s) =>
        (kind === 'all' || s.kind === kind) &&
        (!needle ||
          `${s.designation} ${s.title} ${s.inquiry ?? ''}`
            .toLowerCase()
            .includes(needle)),
    )
  }, [data, kind, query])

  const summary = useMemo(() => {
    if (!data) return []
    const newest = data.latest[0]?.published
    const month = newest
      ? data.latest.filter(
          (s) =>
            Date.parse(newest) - Date.parse(s.published) <= 31 * 86_400_000,
        ).length
      : 0
    const sou = data.per_year.filter(
      (r) => r.kind === 'sou' && r.year <= new Date().getFullYear() - 3,
    )
    const published = sou.reduce((sum, r) => sum + r.published, 0)
    const cited = sou.reduce((sum, r) => sum + r.cited, 0)
    const lastYear = sou.at(-1)?.year
    return [
      l(
        `${month} new studies in the month up to ${day(newest)}.`,
        `${month} nya utredningar och granskningar den senaste månaden, fram till ${day(newest)}.`,
      ),
      published > 0
        ? l(
            `Of the ${published} SOU reports from 2006 to ${lastYear}, ${percent((100 * cited) / published, 0)} are named as the basis of a government bill.`,
            `Av de ${published} SOU-betänkandena 2006–${lastYear} anges ${percent((100 * cited) / published, 0)} som underlag i en proposition.`,
          )
        : null,
      l(
        'A report often takes one to three years to become a bill, so the newest have not led to one yet.',
        'Det tar ofta ett till tre år innan en utredning blir en proposition, så de nyaste har ännu inte lett till någon.',
      ),
    ].filter(Boolean) as string[]
  }, [data])

  const trend: Series[] = useMemo(() => {
    if (!data) return []
    const sou = data.per_year.filter((r) => r.kind === 'sou')
    return [
      {
        key: 'published',
        name: l('SOU reports published', 'SOU-betänkanden publicerade'),
        points: sou.map((r) => ({
          date: `${r.year}-07-01`,
          label: String(r.year),
          value: r.published,
        })),
      },
      {
        key: 'cited',
        name: l(
          'of which named in a bill',
          'varav angivna som underlag i en proposition',
        ),
        points: sou.map((r) => ({
          date: `${r.year}-07-01`,
          label: String(r.year),
          value: r.cited,
        })),
      },
    ]
  }, [data])

  if (error) return <p role="alert">{error}</p>
  if (!data) return <div className="loading">{l('Loading…', 'Laddar…')}</div>
  return (
    <>
      <section
        className="report welfare-section now-summary"
        aria-labelledby="studies-heading"
        id="now-studies"
      >
        <p className="eyebrow">
          {l('Government studies', 'Statliga utredningar')}
        </p>
        <h2 id="studies-heading">
          {l(
            'New studies, and what they led to',
            'Nya utredningar, och vad de ledde till',
          )}
        </h2>
        <ul className="plain-summary" data-testid="studies-summary">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="studies-latest"
      >
        <h3 id="studies-latest" className="analysis-subhead">
          {l('The latest studies', 'De senaste utredningarna')}
        </h3>
        <div className="slicers">
          <label>
            {l('Series', 'Serie')}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value)
                setShown(40)
              }}
              data-field="study-kind"
            >
              <option value="all">{l('All', 'Alla')}</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {l(...data.kinds[k])}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            {l('Search', 'Sök')}
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(40)
              }}
              placeholder={l(
                'e.g. tax, school, SOU 2025:',
                't.ex. skatt, skola, SOU 2025:',
              )}
              data-field="study-search"
            />
          </label>
        </div>
        <ol className="study-list" data-testid="study-list">
          {filtered.slice(0, shown).map((s) => (
            <li key={s.key}>
              <div className="decision-head">
                <span className="decision-date">{day(s.published)}</span>
                <span className="decision-ref">{s.designation}</span>
              </div>
              <a
                className="study-title"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.title}
              </a>
              {s.inquiry && <p className="study-inquiry">{s.inquiry}</p>}
              <p className="study-outcome">
                {s.bills.length === 0
                  ? l('No government bill yet.', 'Ingen proposition ännu.')
                  : s.bills.map((b) => (
                      <span key={b.bill}>
                        {l('Bill', 'Prop.')}{' '}
                        <a href={b.url} target="_blank" rel="noreferrer">
                          {b.bill}
                        </a>{' '}
                        {b.title}
                        {b.decided
                          ? ` – ${l('decided', 'beslutad')} ${day(b.decided)}`
                          : ` – ${l('not yet decided', 'ännu inte beslutad')}`}
                      </span>
                    ))}
              </p>
            </li>
          ))}
        </ol>
        {filtered.length > shown && (
          <button
            type="button"
            className="compact-toggle"
            onClick={() => setShown(shown + 40)}
          >
            {l(
              `Show more (${filtered.length - shown} left)`,
              `Visa fler (${filtered.length - shown} kvar)`,
            )}
          </button>
        )}
        {filtered.length === 0 && (
          <p>{l('No study matches.', 'Ingen utredning matchar.')}</p>
        )}
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="studies-laws"
      >
        <h3 id="studies-laws" className="analysis-subhead">
          {l(
            'Laws recently decided, and the studies behind them',
            'Nyligen beslutade lagar och utredningarna bakom dem',
          )}
        </h3>
        <ol className="study-list" data-testid="recent-laws">
          {data.recent_laws.slice(0, 20).map((law) => (
            <li key={law.bill}>
              <div className="decision-head">
                <span className="decision-date">{day(law.decided)}</span>
                <span className="decision-ref">
                  {l('Bill', 'Prop.')} {law.bill}
                </span>
              </div>
              <a
                className="study-title"
                href={law.url}
                target="_blank"
                rel="noreferrer"
              >
                {law.title}
              </a>
              <StudyLinks studies={law.studies} />
            </li>
          ))}
        </ol>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="studies-trend"
      >
        <h3 id="studies-trend" className="analysis-subhead">
          {l(
            'SOU reports per year, and how many a bill has named',
            'SOU-betänkanden per år, och hur många en proposition har angett som underlag',
          )}
        </h3>
        <MultiLineChart
          series={trend}
          label={l('SOU reports per year', 'SOU-betänkanden per år')}
          format={(v) => String(Math.round(v))}
          colorOf={(key) => (key === 'published' ? 0 : 1)}
        />
        <p className="welfare-note">
          {l(
            "Riksdagen's open data: SOU, Ds and Riksrevisionen's audit reports, and every government bill since 2006/07. A bill's studies are those its section 'Ärendet och dess beredning' names; the link keeps the sentence that names them. Budget bills are left out of the links, since they name hundreds.",
            'Riksdagens öppna data: SOU, Ds och Riksrevisionens granskningsrapporter, och varje proposition sedan 2006/07. En propositions utredningar är de som avsnittet "Ärendet och dess beredning" nämner; kopplingen sparar meningen som nämner dem. Budgetpropositioner är inte med i kopplingen, eftersom de nämner hundratals.',
          )}
        </p>
      </section>
    </>
  )
}
