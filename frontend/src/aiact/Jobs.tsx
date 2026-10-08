/**
 * In the job ads (#ai-act-jobs): how often Swedish job ads use words for AI, AI governance,
 * compliance and model risk, month by month since 2020, next to the AI Act's milestones. Every
 * count is a dictionary match in an ad's headline or description (patterns shown verbatim),
 * never a confirmed requirement, and every share carries its denominator.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { count } from '../format'
import { loadJobs } from './data'
import type { JobsData } from './jobsTypes'
import { yearlyFromMonths } from './logic'
import { Kind } from './shared'
import {
  chartMilestones,
  MilestoneKey,
  sharePct,
  TimePanel,
} from './TimeSeries'
import type { AiActData } from './types'

const FAMILY: Record<string, [string, string]> = {
  context: ['Context', 'Sammanhang'],
  regulation: ['The Act', 'Förordningen'],
  ai_governance: ['AI governance', 'AI-styrning'],
  ml_operations: ['Model operations', 'Modelldrift'],
  data: ['Data', 'Data'],
  general: ['General', 'Allmänt'],
}
const num = count

export function Jobs({
  data,
  term,
  setTerm,
}: {
  data: AiActData
  term: string
  setTerm: (term: string) => void
}) {
  const [jobs, setJobs] = useState<JobsData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadJobs()
      .then(setJobs)
      .catch(() => setFailed(true))
  }, [])
  if (failed)
    return (
      <p className="aa-lede">
        {l(
          'The job-ad data could not be loaded.',
          'Jobbannonsdatan kunde inte laddas.',
        )}
      </p>
    )
  if (!jobs) return <p className="aa-muted">{l('Loading…', 'Laddar…')}</p>
  const s = jobs.summary
  const terms = s.terms
  const active = terms.find((t) => t.term_id === term) ?? terms[0]
  const rows = jobs.monthly.filter((r) => r.term_id === active.term_id)
  const points = rows.map((r) => ({
    month: r.month,
    numerator: r.mention_count,
    denominator: r.ads,
    value: r.share_rolling_3m,
  }))
  const domain: [string, string] = [s.first_month, s.last_month]
  const milestones = chartMilestones(data.timeline, s.last_month)
  const yearly = yearlyFromMonths(points)
  const lastYear = Math.max(...jobs.fields.map((f) => f.year))
  const fields = jobs.fields
    .filter((f) => f.term_id === active.term_id && f.year === lastYear)
    .sort((a, b) => b.share - a.share)
    .slice(0, 8)
  const fieldMax = Math.max(0.0001, ...fields.map((f) => f.share))
  const examples = jobs.examples
    .filter((e) => e.term_id === active.term_id)
    .slice(0, 4)
  const families = [...new Set(terms.map((t) => t.family))]

  return (
    <div className="aa-jobs">
      <p className="aa-lede">
        {l(
          `${num(s.ads)} job ads published on Arbetsförmedlingen's platform from ${s.first_month} to ${s.last_month}, read for ${terms.length} groups of words about AI and its governance. A match means the words appear in the ad; it does not mean the job requires them.`,
          `${num(s.ads)} jobbannonser publicerade på Arbetsförmedlingens plattform från ${s.first_month} till ${s.last_month}, lästa efter ${terms.length} ordgrupper om AI och styrningen av den. En träff betyder att orden står i annonsen, inte att jobbet kräver dem.`,
        )}
      </p>

      <section className="aa-section" aria-labelledby="aa-jobs-share">
        <h2 id="aa-jobs-share">
          {l('How often the words appear', 'Hur ofta orden förekommer')}
        </h2>
        <div
          role="group"
          aria-label={l('Term', 'Term')}
          className="aa-term-chips"
        >
          {families.map((f) => (
            <div key={f} className="aa-term-family">
              <span className="aa-kicker">{l(...(FAMILY[f] ?? [f, f]))}</span>
              {terms
                .filter((t) => t.family === f)
                .map((t) => (
                  <button
                    key={t.term_id}
                    type="button"
                    aria-pressed={t.term_id === active.term_id}
                    onClick={() => setTerm(t.term_id)}
                  >
                    {l(t.label_en, t.label_sv)}
                  </button>
                ))}
            </div>
          ))}
        </div>
        <TimePanel
          label={l(
            `Share of all job ads mentioning “${active.label_en}”, three-month rolling`,
            `Andel av alla jobbannonser som nämner ”${active.label_sv}”, rullande tre månader`,
          )}
          points={points}
          domain={domain}
          milestones={milestones}
          height={260}
          digits={active.term_id === 'ai_any' ? 1 : 3}
          numeratorWord={l('ads with the term', 'annonser med termen')}
          denominatorWord={l('ads', 'annonser')}
        />
        <MilestoneKey milestones={milestones} />
        <p className="aa-caveat">
          {l(
            'Temporal overlap does not prove causation: hiring follows the economy, technology and many rules at once, and an ad that names the Act need not be about it.',
            'Samtidighet bevisar inte orsak: rekrytering följer ekonomin, tekniken och många regler på en gång, och en annons som nämner förordningen behöver inte handla om den.',
          )}
        </p>
        <div
          className="aa-table-wrap"
          tabIndex={0}
          aria-label={l('Per year', 'Per år')}
        >
          <table className="aa-table">
            <caption>
              {l(
                `“${active.label_en}” per year (sums of ads, not averages of months)`,
                `”${active.label_sv}” per år (summor av annonser, inte medel av månader)`,
              )}{' '}
              <Kind type="derived" />
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Year', 'År')}</th>
                <th scope="col">{l('Ads', 'Annonser')}</th>
                <th scope="col">{l('With the term', 'Med termen')}</th>
                <th scope="col">{l('Share', 'Andel')}</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{num(r.denominator)}</td>
                  <td>{num(r.numerator)}</td>
                  <td>{sharePct(r.share, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="aa-section" aria-labelledby="aa-jobs-fields">
        <h2 id="aa-jobs-fields">
          {l(`Where, in ${lastYear}`, `Var, ${lastYear}`)}
        </h2>
        {fields.length === 0 ? (
          <p className="aa-muted">
            {l(
              `No ad matched in ${lastYear}.`,
              `Ingen annons matchade ${lastYear}.`,
            )}
          </p>
        ) : (
          <ul className="aa-field-bars">
            {fields.map((f) => (
              <li key={f.field_id}>
                <span>{f.field}</span>
                <span className="aa-field-track">
                  <i style={{ width: `${(f.share / fieldMax) * 100}%` }} />
                </span>
                <span>
                  {sharePct(f.share, 2)}{' '}
                  <small className="aa-muted">
                    ({num(f.mention_count)}/{num(f.ads)})
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="aa-section" aria-labelledby="aa-jobs-examples">
        <h2 id="aa-jobs-examples">
          {l('What the words catch', 'Vad orden fångar')}
        </h2>
        <p className="aa-muted aa-small">
          {l(
            'Example ads for the chosen term, newest archive first, to judge what the pattern matches. E-mail addresses and phone numbers are masked.',
            'Exempelannonser för vald term, nyaste arkivet först, för att bedöma vad mönstret träffar. E-postadresser och telefonnummer är maskerade.',
          )}
        </p>
        <ul className="aa-examples">
          {examples.map((e, i) => (
            <li key={i}>
              <p className="aa-kicker">
                {e.publication_month}, {e.occupation}, {e.field}
              </p>
              <p>
                <b>{e.headline}</b>
              </p>
              <blockquote>…{e.context}…</blockquote>
            </li>
          ))}
        </ul>
      </section>

      <section className="aa-section" aria-labelledby="aa-jobs-method">
        <h2 id="aa-jobs-method">
          {l('The dictionary and the source', 'Ordlistan och källan')}
        </h2>
        <div
          className="aa-table-wrap"
          tabIndex={0}
          aria-label={l('Dictionary', 'Ordlista')}
        >
          <table className="aa-table">
            <thead>
              <tr>
                <th scope="col">{l('Term', 'Term')}</th>
                <th scope="col">
                  {l(
                    'Pattern (regular expression)',
                    'Mönster (reguljärt uttryck)',
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.term_id}>
                  <td>{l(t.label_en, t.label_sv)}</td>
                  <td>
                    <code>{t.pattern}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="aa-muted aa-small">
          <Kind type="source" label={['Source', 'Källa']} />{' '}
          <a href={s.source.url} rel="noreferrer">
            {s.source.label}
          </a>
          {': '}
          {s.archives
            .map((a) => `${a.archive} (${num(a.ads)})`)
            .join(', ')}.{' '}
          {l(
            'Each archive is counted with its SHA-256 and the dictionary’s; ads repeated within an archive are counted once.',
            'Varje arkiv räknas med sin SHA-256 och ordlistans; annonser som upprepas inom ett arkiv räknas en gång.',
          )}
        </p>
      </section>
    </div>
  )
}
