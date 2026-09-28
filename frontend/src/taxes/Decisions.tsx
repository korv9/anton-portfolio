import { l } from '../i18n'
import { PARTY_ORDER, partyLabel } from '../parliament/data'

export type DecisionStudy = {
  kind: 'sou' | 'ds' | 'rir' | 'pm'
  designation: string
  title: string | null
  url: string
}
export type TaxDecision = {
  key: string
  in_force: string
  year: number
  components: string[]
  direction: 'lower' | 'higher'
  title_sv: string
  title_en: string
  bill: string | null
  bill_title: string | null
  bill_section: string | null
  bill_date: string | null
  department: string | null
  report: string
  origin: 'government' | 'committee' | 'reservation'
  source_url: string
  petrol_sek_per_litre: number | null
  diesel_sek_per_litre: number | null
  months: number | null
  vote: {
    session: string
    point: string
    vote_date: string
    outcome: 'yes' | 'no' | 'tie'
    government_won: boolean | null
    parties: Record<string, [string, string]>
  } | null
  studies: DecisionStudy[]
}
export type Decisions = {
  decisions: TaxDecision[]
  components: Record<string, [string, string]>
  method: string
}

const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const ORIGIN: Record<TaxDecision['origin'], [string, string]> = {
  government: ['Government bill', 'Regeringens proposition'],
  committee: [
    "The committee's own proposal (opposition majority)",
    'Utskottets eget förslag (oppositionens majoritet)',
  ],
  reservation: [
    'A reservation adopted against the government',
    'En reservation som vann mot regeringen',
  ],
}

/** Each party's vote on a decision: for or against what was adopted. */
function Votes({ vote }: { vote: NonNullable<TaxDecision['vote']> }) {
  return (
    <ul
      className="positions"
      aria-label={l('How the parties voted', 'Hur partierna röstade')}
    >
      {PARTY_ORDER.filter((p) => vote.parties[p]).map((party) => {
        const [position] = vote.parties[party]
        const stance =
          position === 'yes' || position === 'no'
            ? position === vote.outcome
              ? 'for'
              : 'against'
            : position
        return (
          <li
            key={party}
            className={`position ${stance === 'for' ? 'yes' : stance === 'against' ? 'no' : 'abstain'}`}
          >
            <strong>{partyLabel(party)}</strong>{' '}
            {stance === 'for'
              ? l('for', 'för')
              : stance === 'against'
                ? l('against', 'emot')
                : position === 'abstain'
                  ? l('abstained', 'avstod')
                  : l('absent', 'frånvarande')}
          </li>
        )
      })}
    </ul>
  )
}

export function DecisionCard({
  decision,
  components,
}: {
  decision: TaxDecision
  components: Decisions['components']
}) {
  const d = decision
  return (
    <li className="tax-decision" data-testid="tax-decision">
      <div className="decision-head">
        <span className="decision-date">{day(d.in_force)}</span>
        <span className={`tax-direction ${d.direction}`}>
          {d.direction === 'lower'
            ? l('↓ Tax cut', '↓ Sänkt skatt')
            : l('↑ Tax rise', '↑ Höjd skatt')}
        </span>
        {d.components.map((c) => (
          <span key={c} className="decision-ref">
            {l(...(components[c] ?? [c, c]))}
          </span>
        ))}
      </div>
      <p className="decision-title">{l(d.title_en, d.title_sv)}</p>
      <p className="tax-decision-source">
        {l(...ORIGIN[d.origin])}
        {d.bill && (
          <>
            {': '}
            <a href={d.source_url} target="_blank" rel="noreferrer">
              {l('Bill', 'Prop.')} {d.bill}
              {d.bill_section
                ? ` ${l('section', 'avsnitt')} ${d.bill_section}`
                : ''}
            </a>
          </>
        )}
        {' · '}
        {!d.bill ? (
          <a href={d.source_url} target="_blank" rel="noreferrer">
            {l('Report', 'Betänkande')} {d.report}
          </a>
        ) : (
          <>
            {l('Report', 'Betänkande')} {d.report}
          </>
        )}
        {d.vote && (
          <>
            {' · '}
            {l('decided', 'beslutat')} {day(d.vote.vote_date)}
            {d.vote.government_won === false &&
              ` · ${l('the government lost the vote', 'regeringen förlorade omröstningen')}`}
          </>
        )}
      </p>
      {d.vote && <Votes vote={d.vote} />}
      {d.studies.length > 0 && (
        <p className="study-links">
          <span>{l('Prepared in', 'Bereddes i')}:</span>{' '}
          {d.studies.map((s, index) => (
            <span key={s.designation}>
              {index > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.kind === 'pm'
                  ? l('Memorandum', 'Promemoria')
                  : s.designation}
              </a>{' '}
              {s.title}
            </span>
          ))}
        </p>
      )}
    </li>
  )
}

/** Every decision, newest year first. */
export function DecisionTimeline({ data }: { data: Decisions }) {
  const years = [...new Set(data.decisions.map((d) => d.year))].sort(
    (a, b) => b - a,
  )
  return (
    <div className="tax-timeline">
      {years.map((year) => {
        const items = data.decisions.filter((d) => d.year === year)
        const lower = items.filter((d) => d.direction === 'lower').length
        return (
          <section key={year} aria-labelledby={`tax-year-${year}`}>
            <h3 id={`tax-year-${year}`} className="analysis-subhead">
              {year}{' '}
              <span className="tax-year-count">
                {l(
                  `${lower} cuts, ${items.length - lower} rises`,
                  `${lower} sänkningar, ${items.length - lower} höjningar`,
                )}
              </span>
            </h3>
            <ol className="decision-list">
              {items.map((d) => (
                <DecisionCard
                  key={d.key}
                  decision={d}
                  components={data.components}
                />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

/** The latest decision on each part of the tax system. */
export function LastChanged({ data }: { data: Decisions }) {
  const latest = new Map<string, TaxDecision>()
  for (const d of data.decisions)
    for (const c of d.components)
      if (!latest.has(c) || latest.get(c)!.in_force < d.in_force)
        latest.set(c, d)
  const rows = [...latest].sort((a, b) =>
    b[1].in_force.localeCompare(a[1].in_force),
  )
  return (
    <table className="welfare-table" data-testid="last-changed">
      <thead>
        <tr>
          <th>{l('Tax', 'Skatt')}</th>
          <th>{l('Last changed', 'Senast ändrad')}</th>
          <th>{l('Decision', 'Beslut')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([component, d]) => (
          <tr key={component}>
            <td>
              {l(...(data.components[component] ?? [component, component]))}
            </td>
            <td>{day(d.in_force)}</td>
            <td>
              <span className={`tax-direction ${d.direction}`}>
                {d.direction === 'lower' ? '↓' : '↑'}
              </span>{' '}
              {l(d.title_en, d.title_sv)}
              {d.bill ? ` (${l('bill', 'prop.')} ${d.bill})` : ` (${d.report})`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
