/**
 * Läget just nu, as one screen. The budget comes first: what the parties want to spend money
 * on is where priorities show in kronor. Around it: key figures, the latest survey, who votes
 * alike, what the parties talk about and the seats. Every card follows the parties chosen in
 * the party bar, and any number of parties can be compared side by side. Slicers above the
 * cards (budget year, number of areas, order, measure, survey comparison) are kept in the
 * address like the parties. Everything comes from the published data files.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { load, type Now, type Sessions } from '../../parliament/data'
import type { News } from '../../parliament/News'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  identity,
  partyName,
} from '../../parties/identity'
import type { Route } from '../../router'
import { useViewParams } from '../useViewParams'
import { shownParties, useParties, withParties } from '../partySelection'
import {
  areaNames,
  budgetBasis,
  loadBudgetReport,
  type BudgetReport,
  type BudgetRow,
} from '../themes/BudgetTheme'
import { Select, dayName, monthName, num, pct, signed } from '../controls'
import { CountUp } from './motion'
import DashBars from './DashBars'
import GroupedBars from './GroupedBars'
import Heatmap from './Heatmap'
import './dash.css'

type PollRow = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
}

const SLICERS = {
  ar: '',
  omraden: '8',
  ordning: 'storst',
  matt: 'mnkr',
  jmf: 'forra',
}

function Card({
  title,
  meta,
  href,
  index,
  children,
  className = '',
}: {
  title: string
  meta: string
  href: string
  index: number
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`dash-card ${className}`}
      style={{ ['--i' as string]: index }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <a href={href} aria-label={l(`More: ${title}`, `Mer: ${title}`)}>
          {l('More', 'Mer')} →
        </a>
      </header>
      <p className="dash-meta">{meta}</p>
      <div className="dash-body">{children}</div>
    </section>
  )
}

function Kpi({
  label,
  value,
  format,
  sub,
  index,
}: {
  label: string
  value: number
  format: (v: number) => string
  sub?: string
  index: number
}) {
  return (
    <div className="dash-kpi" style={{ ['--i' as string]: index }}>
      <dt>{label}</dt>
      <dd>
        <CountUp value={value} format={format} />
      </dd>
      {sub && <dd className="dash-kpi-sub">{sub}</dd>}
    </div>
  )
}

export default function Dashboard({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, SLICERS)
  const { selected, toggle } = useParties(route)
  const [now, setNow] = useState<Now | null>(null)
  const [polls, setPolls] = useState<PollRow[] | null>(null)
  const [sessions, setSessions] = useState<Sessions | null>(null)
  const [report, setReport] = useState<BudgetReport | null>(null)
  const [news, setNews] = useState<News | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load<Now>('parliament/now.json')
      .then(setNow)
      .catch((e: Error) => setError(e.message))
    load<{ polls: PollRow[] }>('parliament/polls.json')
      .then((p) => setPolls(p.polls))
      .catch(() => {})
    load<Sessions>('parliament/sessions.json')
      .then(setSessions)
      .catch(() => {})
    loadBudgetReport()
      .then(setReport)
      .catch(() => {})
    load<News>('parliament/news.json')
      .then(setNews)
      .catch(() => {})
  }, [])

  const chosen = shownParties(selected, [])
  const single = chosen.length === 1 ? chosen[0] : null
  const shown = shownParties(selected)

  // ---- Seats and government ----
  const seated = now?.election.parties.filter((p) => p.seats > 0) ?? []
  const largest = [...seated].sort((a, b) => b.seats - a.seats)[0]
  const gov = now?.government
  const side = [
    ...(gov?.government_parties ?? []),
    ...(gov?.agreement_parties ?? []),
  ]
  const sideSeats = seated
    .filter((p) => side.includes(p.party))
    .reduce((s, p) => s + p.seats, 0)
  const majority = now?.election.majority ?? 175

  // ---- Budget: grouped bars, one per party, for the areas that differ most ----
  const budgetRows = report?.budgets ?? []
  const names = useMemo(() => areaNames(budgetRows), [budgetRows])
  const years = [...new Set(budgetRows.map((r) => r.budget_year))].sort(
    (a, b) => b - a,
  )
  const year = years.includes(Number(view.ar))
    ? Number(view.ar)
    : (years[0] ?? 0)
  const yearRows = budgetRows.filter((r) => r.budget_year === year)
  const budgetParties = RIKSDAG_PARTIES.filter((p) =>
    yearRows.some((r) => r.actor === p),
  )
  // Parties in or supporting the government table no budget of their own: when none of the
  // chosen parties has one, the card shows the opposition's budgets instead of nothing.
  const chosenBudgets = chosen.filter((p) => budgetParties.includes(p))
  const budgetShown = chosenBudgets.length ? chosenBudgets : budgetParties
  const noBudget = chosen.filter((p) => !budgetParties.includes(p))
  const percent = view.matt === 'procent'
  const valueOf = (r: BudgetRow) =>
    percent
      ? r.government_amount_msek
        ? (r.deviation_msek / r.government_amount_msek) * 100
        : 0
      : r.deviation_msek
  const budgetFormat = percent ? (v: number) => `${signed(v, 1)} %` : signed
  const cell = (area: number, party: string) => {
    const r = yearRows.find(
      (x) => x.actor === party && x.expenditure_area === area,
    )
    return r ? valueOf(r) : null
  }
  const areas = [...new Set(yearRows.map((r) => r.expenditure_area))]
  const reach = (area: number) =>
    Math.max(0, ...budgetShown.map((p) => Math.abs(cell(area, p) ?? 0)))
  const total = (area: number) =>
    budgetShown.reduce((s, p) => s + (cell(area, p) ?? 0), 0)
  const ranked = [...areas]
    .filter((a) => reach(a) > 0)
    .sort((a, b) => reach(b) - reach(a))
  const limit = view.omraden === 'alla' ? ranked.length : Number(view.omraden)
  const budgetAreas = ranked
    .slice(0, limit || 8)
    .sort((a, b) =>
      view.ordning === 'nummer'
        ? a - b
        : view.ordning === 'satsning'
          ? total(b) - total(a)
          : reach(b) - reach(a),
    )
  const basis = budgetBasis(report, year)
  const net = basis.net

  // ---- Polls ----
  const months = useMemo(
    () => (polls ? [...new Set(polls.map((p) => p.survey_month))].sort() : []),
    [polls],
  )
  const latestMonth = months.at(-1) ?? ''
  const prevMonth = months.at(-2) ?? ''
  const pollOf = (party: string, month: string) =>
    polls?.find((p) => p.party === party && p.survey_month === month)
  const vsElection = view.jmf === 'valet'
  const baseline = (party: string) =>
    vsElection
      ? seated.find((s) => s.party === party)?.share_pct
      : pollOf(party, prevMonth)?.share_pct
  const pollBars = shown
    .map((party) => {
      const value = pollOf(party, latestMonth)?.share_pct
      const before = baseline(party)
      return value == null
        ? null
        : {
            key: party,
            label: `${party} · ${partyName(party)}`,
            value,
            party,
            ref: before ?? null,
            note: before != null ? ` ${signed(value - before, 1)}` : undefined,
          }
    })
    .filter((b): b is NonNullable<typeof b> => b != null)
    .sort((a, b) => b.value - a.value)
  const movers = RIKSDAG_PARTIES.map((party) => {
    const a = pollOf(party, latestMonth)
    const b = pollOf(party, prevMonth)
    return a && b ? { party, change: a.share_pct - b.share_pct } : null
  }).filter(Boolean) as { party: string; change: number }[]
  const mover = [...movers].sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change),
  )[0]

  // ---- Votes ----
  const lastSession = sessions?.sessions.at(-1)
  const pairs =
    sessions?.party_pairs.filter((p) => p.session === lastSession?.session) ??
    []
  const agreement = (a: string, b: string) =>
    a === b
      ? null
      : pairs.find(
          (x) =>
            (x.party_a === a && x.party_b === b) ||
            (x.party_a === b && x.party_b === a),
        )?.agreement_pct
  const alike = single
    ? RIKSDAG_PARTIES.filter((p) => p !== single)
        .map((p) => ({ party: p, value: agreement(single, p) }))
        .filter((x): x is { party: string; value: number } => x.value != null)
        .sort((a, b) => b.value - a.value)
    : []
  const recordOf = (party: string) =>
    sessions?.party_record.find(
      (r) => r.session === lastSession?.session && r.party === party,
    )
  const govWon = sessions?.government_record.at(-1)

  // ---- Talk: the areas the parties talk about most, latest session ----
  const talkRows = (report?.language.rows ?? []).filter(
    (r) => r.corpus === 'issues' && r.method === 'stem',
  )
  const talkSession =
    [...new Set(talkRows.map((r) => r.session))].sort().at(-1) ?? ''
  const talkNow = talkRows.filter((r) => r.session === talkSession)
  const talkOf = (area: number, party: string) =>
    talkNow.find((r) => r.expenditure_area === area && r.party === party)
      ?.keyword_share_pct
  const talkAreas = [...new Set(talkNow.map((r) => r.expenditure_area))]
    .map((area) => ({
      area,
      top: Math.max(0, ...shown.map((p) => talkOf(area, p) ?? 0)),
    }))
    .sort((a, b) => b.top - a.top)
    .slice(0, single ? 7 : 5)
    .map((a) => a.area)

  // ---- What to keep an eye on ----
  const attention: string[] = []
  if (gov?.status_note)
    attention.push(
      `${gov.government_name}: ${gov.status_note.charAt(0).toLowerCase()}${gov.status_note.slice(1)}.`,
    )
  const headline = (news?.items ?? []).find(
    (i) => !chosen.length || i.parties.some((p) => chosen.includes(p)),
  )
  if (headline)
    attention.push(
      `${l('News', 'Nyhet')} ${dayName(headline.published_at)}: ${headline.title}`,
    )
  else if (now?.formation_news[0])
    attention.push(
      `${l('Latest', 'Senast')} (${dayName(now.formation_news[0].date)}): ${now.formation_news[0].title}.`,
    )
  if (mover && !chosen.length)
    attention.push(
      l(
        `Biggest shift in SCB’s latest survey: ${partyName(mover.party)}, ${signed(mover.change, 1)} points (${monthName(latestMonth)}).`,
        `Störst förändring i SCB:s senaste mätning: ${partyName(mover.party)}, ${signed(mover.change, 1)} procentenheter (${monthName(latestMonth)}).`,
      ),
    )

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!now)
    return (
      <p className="theme-loading" role="status">
        {l('Loading data…', 'Hämtar data…')}
      </p>
    )

  let seatOffset = 0
  const seatOrder = [
    ...seated.filter((s) => gov?.government_parties.includes(s.party)),
    ...seated.filter((s) => gov?.agreement_parties?.includes(s.party)),
    ...seated.filter((s) => !side.includes(s.party)),
  ]
  const focusResult = single ? seated.find((p) => p.party === single) : null
  const focusPoll = single ? pollOf(single, latestMonth) : null
  const focusPrev = single ? pollOf(single, prevMonth) : null
  const focusRecord = single ? recordOf(single) : null

  const partiesLabel = chosen.length
    ? chosen.join(', ')
    : l('all parties', 'alla partier')

  return (
    <div className="dash" data-parties={chosen.join(',') || undefined}>
      <header className="dash-head">
        <div>
          <h1>
            {l('Overview', 'Översikt')}
            {chosen.length > 0 && (
              <span className="dash-focus">
                {chosen.map((p) => (
                  <PartyLogo key={p} party={p} size={18} />
                ))}
                {single ? partyName(single) : chosen.join(' · ')}
              </span>
            )}
          </h1>
          <p className="dash-sub">
            {l('Updated', 'Uppdaterad')} {dayName(now.generated_at)} ·{' '}
            {chosen.length
              ? l(
                  'Every card compares the chosen parties.',
                  'Alla kort jämför valda partier.',
                )
              : l(
                  'Choose parties in the bar above to compare them.',
                  'Välj partier i raden ovanför för att jämföra dem.',
                )}
            {single && (
              <>
                {' · '}
                <a
                  className="dash-partylink"
                  href={`#parties-${single.toLowerCase()}`}
                >
                  {l(`Everything about ${single}`, `Allt om ${single}`)} →
                </a>
              </>
            )}
          </p>
        </div>
        <div className="dash-slicers" aria-label={l('Filters', 'Filter')}>
          <Select
            label={l('Budget year', 'Budgetår')}
            value={String(year)}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
            onChange={(ar) => setView({ ar })}
          />
          <Select
            label={l('Areas', 'Områden')}
            value={view.omraden}
            options={[
              { value: '5', label: l('Top 5', 'Topp 5') },
              { value: '8', label: l('Top 8', 'Topp 8') },
              { value: '12', label: l('Top 12', 'Topp 12') },
              { value: 'alla', label: l('All', 'Alla') },
            ]}
            onChange={(omraden) => setView({ omraden })}
          />
          <Select
            label={l('Order', 'Sortering')}
            value={view.ordning}
            options={[
              {
                value: 'storst',
                label: l('Largest difference', 'Störst skillnad'),
              },
              {
                value: 'satsning',
                label: l('Most added', 'Mest satsat'),
              },
              { value: 'nummer', label: l('Area number', 'Områdesnummer') },
            ]}
            onChange={(ordning) => setView({ ordning })}
          />
          <Select
            label={l('Measure', 'Mått')}
            value={percent ? 'procent' : 'mnkr'}
            options={[
              { value: 'mnkr', label: l('SEK m', 'Mnkr') },
              {
                value: 'procent',
                label: l('% of the budget', '% av budgeten'),
              },
            ]}
            onChange={(matt) => setView({ matt })}
          />
          <Select
            label={l('Survey against', 'Mätning mot')}
            value={vsElection ? 'valet' : 'forra'}
            options={[
              {
                value: 'forra',
                label: l('Previous survey', 'Förra mätningen'),
              },
              {
                value: 'valet',
                label: l(
                  `Election ${now.election.year}`,
                  `Valet ${now.election.year}`,
                ),
              },
            ]}
            onChange={(jmf) => setView({ jmf })}
          />
        </div>
      </header>

      {chosen.length > 1 ? (
        <ul
          className="dash-compare"
          aria-label={l('The chosen parties', 'Valda partier')}
        >
          {chosen.map((party, i) => {
            const result = seated.find((s) => s.party === party)
            const poll = pollOf(party, latestMonth)
            const before = baseline(party)
            const rec = recordOf(party)
            return (
              <li
                key={party}
                style={{
                  ['--i' as string]: i,
                  borderTopColor: identity(party).color,
                }}
              >
                <p>
                  <PartyLogo party={party} size={18} />
                  <b>{partyName(party)}</b>
                </p>
                <dl>
                  <div>
                    <dt>{l('Seats', 'Mandat')}</dt>
                    <dd>{result ? num(result.seats) : '–'}</dd>
                  </div>
                  <div>
                    <dt>PSU</dt>
                    <dd>
                      {poll ? pct(poll.share_pct) : '–'}
                      {poll && before != null && (
                        <small> {signed(poll.share_pct - before, 1)}</small>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{l('With gov.', 'Som reg.')}</dt>
                    <dd>
                      {rec?.with_government_pct != null
                        ? pct(rec.with_government_pct, 0)
                        : '–'}
                    </dd>
                  </div>
                  <div>
                    <dt>{l('Budget, total', 'Budget, totalt')}</dt>
                    <dd>
                      {budgetParties.includes(party) ? signed(net(party)) : '–'}
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      ) : (
        <dl className="dash-kpis">
          {single ? (
            <>
              <Kpi
                index={0}
                label={l('Seats', 'Mandat')}
                value={focusResult?.seats ?? 0}
                format={(v) => num(v)}
                sub={
                  focusResult?.previous_seats != null
                    ? `${signed(focusResult.seats - focusResult.previous_seats)} ${l('since last election', 'sedan förra valet')}`
                    : undefined
                }
              />
              <Kpi
                index={1}
                label={l('Election result', 'Valresultat')}
                value={focusResult?.share_pct ?? 0}
                format={(v) => pct(v, 1)}
                sub={`${l('election', 'valet')} ${now.election.year}`}
              />
              <Kpi
                index={2}
                label={l('Latest survey (PSU)', 'Senaste mätning (PSU)')}
                value={focusPoll?.share_pct ?? 0}
                format={(v) => pct(v, 1)}
                sub={
                  focusPoll && focusPrev
                    ? `${signed(focusPoll.share_pct - focusPrev.share_pct, 1)} p.e. · ${monthName(latestMonth)}`
                    : undefined
                }
              />
              <Kpi
                index={3}
                label={l('Voted with the government', 'Röstade som regeringen')}
                value={focusRecord?.with_government_pct ?? 0}
                format={(v) => pct(v, 0)}
                sub={lastSession?.session}
              />
              <Kpi
                index={4}
                label={l('Budget in total', 'Budget totalt')}
                value={budgetParties.includes(single!) ? net(single!) : 0}
                format={(v) =>
                  budgetParties.includes(single!) ? signed(v) : '–'
                }
                sub={
                  budgetParties.includes(single!)
                    ? `${l('SEK m', 'mnkr')}, ${basis.short.toLowerCase()} ${year}`
                    : l('no budget of its own', 'ingen egen budget')
                }
              />
              <Kpi
                index={5}
                label={l('In the news, 30 days', 'I nyheterna, 30 dagar')}
                value={news?.party_counts_30d[single!] ?? 0}
                format={(v) => num(v)}
                sub={l('items naming the party', 'nyheter som nämner partiet')}
              />
            </>
          ) : (
            <>
              <Kpi
                index={0}
                label={l('Largest party', 'Största parti')}
                value={largest?.seats ?? 0}
                format={(v) => `${largest?.party} ${num(v)}`}
                sub={l('seats', 'mandat')}
              />
              <Kpi
                index={1}
                label={l('Governing side', 'Regeringssidan')}
                value={sideSeats}
                format={(v) => `${num(v)} / 349`}
                sub={side.join(', ')}
              />
              <Kpi
                index={2}
                label={l('Needed for a majority', 'Krävs för majoritet')}
                value={majority}
                format={(v) => num(v)}
                sub={
                  sideSeats < majority
                    ? l(
                        `${majority - sideSeats} short`,
                        `${majority - sideSeats} mandat saknas`,
                      )
                    : undefined
                }
              />
              <Kpi
                index={3}
                label={l('Largest in the survey', 'Störst i mätningen')}
                value={pollBars[0]?.value ?? 0}
                format={(v) => `${pollBars[0]?.party ?? ''} ${pct(v, 1)}`}
                sub={`PSU ${monthName(latestMonth)}`}
              />
              <Kpi
                index={4}
                label={l('Roll calls', 'Voteringar')}
                value={lastSession?.roll_calls ?? 0}
                format={(v) => num(v)}
                sub={lastSession?.session}
              />
              <Kpi
                index={5}
                label={l('Government won', 'Regeringen vann')}
                value={govWon?.government_won_pct ?? 0}
                format={(v) => pct(v, 0)}
                sub={l(
                  `of decisions ${govWon?.session ?? ''}`,
                  `av besluten ${govWon?.session ?? ''}`,
                )}
              />
            </>
          )}
        </dl>
      )}

      {attention.length > 0 && (
        <section className="dash-attention" aria-labelledby="dash-attention">
          <h2 id="dash-attention">
            {l('Worth keeping an eye on', 'Att hålla koll på')}
          </h2>
          <ul>
            {attention.slice(0, 2).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="dash-grid">
        <Card
          index={0}
          className="dash-budget"
          title={l(
            'What the parties want to spend money on',
            'Vad partierna vill lägga pengar på',
          )}
          meta={l(
            `${percent ? 'Per cent' : 'SEK m'} ${basis.long}`,
            `${percent ? 'Procent' : 'Mnkr'} ${basis.long}`,
          )}
          href={withParties('#politik-budget', chosen)}
        >
          {report && noBudget.length > 0 && (
            <p className="dash-empty dash-note">
              {l(
                `${noBudget.join(', ')}: no budget of their own in ${year}. Parties in or supporting the government do not table one${chosenBudgets.length ? '' : ', so the opposition’s budgets are shown'}.`,
                `${noBudget.join(', ')}: ingen egen budget ${year}. Partier i eller som stöder regeringen lägger ingen${chosenBudgets.length ? '' : ', så oppositionens budgetar visas'}.`,
              )}
            </p>
          )}
          {!report ? (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          ) : budgetShown.length ? (
            <>
              <ul className="dash-legend" aria-hidden="true">
                {budgetShown.map((p) => (
                  <li key={p}>
                    <i
                      style={{
                        background: identity(p).color,
                        outline: identity(p).casing
                          ? `1px solid ${identity(p).casing}`
                          : undefined,
                      }}
                    />
                    {p}
                    <small>
                      {l('total', 'totalt')} {signed(net(p))}
                    </small>
                  </li>
                ))}
              </ul>
              <GroupedBars
                groups={budgetAreas.map((area) => ({
                  key: String(area),
                  label: names.get(area) ?? String(area),
                  values: budgetShown.map((party) => ({
                    party,
                    value: cell(area, party),
                  })),
                }))}
                format={budgetFormat}
                label={l(
                  `Difference per area, ${basis.long}: ${budgetShown.join(', ')}`,
                  `Skillnad per område, ${basis.long}: ${budgetShown.join(', ')}`,
                )}
              />
            </>
          ) : null}
        </Card>

        <Card
          index={1}
          title={l('What voters think', 'Vad väljarna tycker')}
          meta={l(
            `SCB PSU ${monthName(latestMonth)} · tick: ${vsElection ? `election ${now.election.year}` : monthName(prevMonth)}`,
            `SCB:s PSU ${monthName(latestMonth)} · streck: ${vsElection ? `valet ${now.election.year}` : monthName(prevMonth)}`,
          )}
          href={withParties('#politik-valjarna', chosen)}
        >
          {polls ? (
            <DashBars
              bars={pollBars}
              format={(v) => pct(v, 1)}
              label={l(
                `Support in the latest survey, ${partiesLabel}`,
                `Stöd i senaste mätningen, ${partiesLabel}`,
              )}
            />
          ) : (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          )}
        </Card>

        <Card
          index={2}
          title={
            single
              ? l(`Who ${single} votes like`, `Vilka ${single} röstar som`)
              : l('Who votes alike', 'Vilka som röstar lika')
          }
          meta={l(
            `Share of roll calls with the same position · ${lastSession?.session ?? ''}`,
            `Andel voteringar med samma ståndpunkt · ${lastSession?.session ?? ''}`,
          )}
          href={withParties('#politik-roster', chosen)}
        >
          {single ? (
            <DashBars
              bars={alike.map((a) => ({
                key: a.party,
                label: `${a.party} · ${partyName(a.party)}`,
                value: a.value,
                party: a.party,
              }))}
              format={(v) => pct(v, 0)}
              max={100}
              label={l(
                `How often ${partyName(single)} voted like each party`,
                `Hur ofta ${partyName(single)} röstade som varje parti`,
              )}
            />
          ) : sessions ? (
            <Heatmap
              rows={shown.map((p) => ({ key: p, label: partyName(p) }))}
              rowHeader="party"
              parties={shown}
              value={agreement}
              format={(v) => num(v)}
              caption={l(
                `Per cent of roll calls ${lastSession?.session ?? ''} on which two parties voted alike`,
                `Procent av voteringarna ${lastSession?.session ?? ''} där två partier röstade lika`,
              )}
            />
          ) : (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          )}
        </Card>

        <Card
          index={3}
          title={l('What the parties talk about', 'Vad partierna pratar om')}
          meta={l(
            `Share of issue words · all issue debates · ${talkSession}`,
            `Andel av ämnesorden · alla sakdebatter · ${talkSession}`,
          )}
          href={withParties('#politik-tal', chosen)}
        >
          {!report ? (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          ) : single ? (
            <DashBars
              bars={talkAreas.map((area) => ({
                key: String(area),
                label: names.get(area) ?? String(area),
                value: talkOf(area, single) ?? 0,
                tone: 'neutral' as const,
              }))}
              format={(v) => pct(v, 1)}
              label={l(
                `What ${partyName(single)} talks about most`,
                `Vad ${partyName(single)} pratar mest om`,
              )}
            />
          ) : (
            <Heatmap
              rows={talkAreas.map((area) => ({
                key: String(area),
                label: names.get(area) ?? String(area),
              }))}
              parties={shown}
              value={(area, party) => talkOf(Number(area), party)}
              format={(v) => num(v, 0)}
              caption={l(
                `Per cent of each party’s issue words per area, ${talkSession}`,
                `Procent av varje partis ämnesord per område, ${talkSession}`,
              )}
            />
          )}
        </Card>

        <Card
          index={4}
          title={l('Seats in the Riksdag', 'Mandat i riksdagen')}
          meta={l(
            `Election ${now.election.year} · line at ${majority} · click a party to choose it`,
            `Valet ${now.election.year} · linjen vid ${majority} · klicka för att välja parti`,
          )}
          href="#now-seats"
        >
          <div
            className="dash-seats"
            role="group"
            aria-label={seated.map((s) => `${s.party} ${s.seats}`).join(', ')}
          >
            {seatOrder.map((s, i) => {
              const left = (seatOffset / 349) * 100
              seatOffset += s.seats
              const m = identity(s.party)
              return (
                <button
                  type="button"
                  key={s.party}
                  className={
                    chosen.length && !chosen.includes(s.party)
                      ? 'dash-seat dim'
                      : 'dash-seat'
                  }
                  style={{
                    left: `${left}%`,
                    width: `${(s.seats / 349) * 100}%`,
                    background: m.color,
                    color: m.ink,
                    outline: m.casing ? `1px solid ${m.casing}` : undefined,
                    outlineOffset: -1,
                    ['--i' as string]: i,
                  }}
                  onClick={() => toggle(s.party)}
                  aria-label={`${partyName(s.party)}: ${s.seats} ${l('seats', 'mandat')}`}
                  aria-pressed={chosen.includes(s.party)}
                >
                  <b>{s.party}</b>
                  <small>{s.seats}</small>
                </button>
              )
            })}
            <span
              className="dash-majority"
              style={{ left: `${(majority / 349) * 100}%` }}
            />
          </div>
          <dl className="dash-blocs">
            <div>
              <dt>{l('Government', 'Regeringen')}</dt>
              <dd>{gov?.government_parties.join(', ')}</dd>
            </div>
            <div>
              <dt>{l('Support', 'Stödparti')}</dt>
              <dd>{gov?.agreement_parties?.join(', ') ?? '–'}</dd>
            </div>
            <div>
              <dt>{l('Governing side', 'Regeringssidan')}</dt>
              <dd>
                {sideSeats} {l('seats', 'mandat')}
              </dd>
            </div>
            {chosen.length > 0 && (
              <div>
                <dt>{l('Chosen parties', 'Valda partier')}</dt>
                <dd>
                  {seated
                    .filter((s) => chosen.includes(s.party))
                    .reduce((sum, s) => sum + s.seats, 0)}{' '}
                  {l('seats', 'mandat')}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
      <p className="dash-foot">
        {l('Sources', 'Källor')}: Valmyndigheten, SCB,{' '}
        {l('the Riksdag', 'riksdagen')}, Regeringskansliet, SVT, Ekot ·{' '}
        <a href="#now-news">{l('All news', 'Alla nyheter')}</a> ·{' '}
        <a href="#politik-kallor">
          {l('Sources and method', 'Källor och metod')}
        </a>
      </p>
    </div>
  )
}
