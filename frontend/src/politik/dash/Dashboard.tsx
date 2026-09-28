/**
 * Läget just nu, as one screen: key figures, what to keep an eye on, and six cards (seats,
 * polls, who votes alike, budget, what the party talks about, news). Choosing a party in the
 * side list focuses every card on it; the choice is kept in the address (`#politik?parti=S`).
 * Everything comes from the published data files; nothing here is estimated.
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
import {
  areaNames,
  loadBudgetReport,
  type BudgetReport,
} from '../themes/BudgetTheme'
import { dayName, monthName, num, pct, signed } from '../controls'
import { CountUp } from './motion'
import MiniLines from './MiniLines'
import DashBars from './DashBars'
import './dash.css'

type PollRow = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
}

function Card({
  title,
  meta,
  href,
  index,
  children,
  wide = false,
}: {
  title: string
  meta: string
  href: string
  index: number
  children: ReactNode
  wide?: boolean
}) {
  return (
    <section
      className={wide ? 'dash-card wide' : 'dash-card'}
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
  tone,
}: {
  label: string
  value: number
  format: (v: number) => string
  sub?: string
  index: number
  tone?: string
}) {
  return (
    <div className="dash-kpi" style={{ ['--i' as string]: index }}>
      <dt>{label}</dt>
      <dd style={tone ? { color: tone } : undefined}>
        <CountUp value={value} format={format} />
      </dd>
      {sub && <p>{sub}</p>}
    </div>
  )
}

export default function Dashboard({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, { parti: '' })
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

  const chosen = RIKSDAG_PARTIES.includes(view.parti) ? view.parti : null
  const choose = (party: string | null) => setView({ parti: party ?? '' })

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
  // Party-specific cards follow the chosen party, or the largest party until one is chosen.
  const focus = chosen ?? largest?.party ?? 'S'
  const focusResult = seated.find((p) => p.party === focus)

  // ---- Polls ----
  const months = useMemo(
    () => (polls ? [...new Set(polls.map((p) => p.survey_month))].sort() : []),
    [polls],
  )
  const latestMonth = months.at(-1) ?? ''
  const prevMonth = months.at(-2) ?? ''
  const pollOf = (party: string, month: string) =>
    polls?.find((p) => p.party === party && p.survey_month === month)
  const pollSeries = useMemo(
    () =>
      RIKSDAG_PARTIES.map((party) => ({
        party,
        points: (polls ?? [])
          .filter((p) => p.party === party && p.survey_month >= '2014-01-01')
          .map((p) => ({
            date: p.survey_month,
            value: p.share_pct,
            label: monthName(p.survey_month),
          })),
      })),
    [polls],
  )
  const movers = RIKSDAG_PARTIES.map((party) => {
    const a = pollOf(party, latestMonth)
    const b = pollOf(party, prevMonth)
    return a && b ? { party, change: a.share_pct - b.share_pct } : null
  }).filter(Boolean) as { party: string; change: number }[]
  const mover = [...movers].sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change),
  )[0]
  const focusPoll = pollOf(focus, latestMonth)
  const focusPrev = pollOf(focus, prevMonth)

  // ---- Votes ----
  const lastSession = sessions?.sessions.at(-1)
  const pairs =
    sessions?.party_pairs.filter((p) => p.session === lastSession?.session) ??
    []
  const alike = RIKSDAG_PARTIES.filter((p) => p !== focus)
    .map((p) => ({
      party: p,
      value: pairs.find(
        (x) =>
          (x.party_a === focus && x.party_b === p) ||
          (x.party_a === p && x.party_b === focus),
      )?.agreement_pct,
    }))
    .filter((x): x is { party: string; value: number } => x.value != null)
    .sort((a, b) => b.value - a.value)
  const record = sessions?.party_record.find(
    (r) => r.session === lastSession?.session && r.party === focus,
  )
  const govWon = sessions?.government_record.at(-1)

  // ---- Budget: the latest year in which the party tabled its own budget ----
  const budgetRows = report?.budgets ?? []
  const names = useMemo(() => areaNames(budgetRows), [budgetRows])
  const budgetYear = Math.max(
    0,
    ...budgetRows.filter((r) => r.actor === focus).map((r) => r.budget_year),
  )
  const partyBudget = budgetRows
    .filter(
      (r) =>
        r.actor === focus &&
        r.budget_year === budgetYear &&
        r.deviation_msek !== 0,
    )
    .sort((a, b) => b.deviation_msek - a.deviation_msek)
  const budgetShown =
    partyBudget.length > 8
      ? [...partyBudget.slice(0, 4), ...partyBudget.slice(-4)]
      : partyBudget
  const budgetNet = budgetRows
    .filter((r) => r.actor === focus && r.budget_year === budgetYear)
    .reduce((s, r) => s + r.deviation_msek, 0)

  // ---- Talk: the areas the party talks about most, latest session ----
  const talkRows = (report?.language.rows ?? []).filter(
    (r) => r.corpus === 'issues' && r.method === 'stem',
  )
  const talkSession =
    [...new Set(talkRows.map((r) => r.session))].sort().at(-1) ?? ''
  const talkTop = talkRows
    .filter((r) => r.session === talkSession && r.party === focus)
    .sort((a, b) => b.keyword_share_pct - a.keyword_share_pct)
    .slice(0, 6)

  // ---- News ----
  const newsItems = (news?.items ?? [])
    .filter((i) => !chosen || i.parties.includes(chosen))
    .slice(0, 6)

  // ---- What to keep an eye on ----
  const attention: string[] = []
  if (gov?.status_note)
    attention.push(
      `${gov.government_name}: ${gov.status_note.charAt(0).toLowerCase()}${gov.status_note.slice(1)}.`,
    )
  if (now?.formation_news[0])
    attention.push(
      l(
        `Latest (${dayName(now.formation_news[0].date)}): ${now.formation_news[0].title}.`,
        `Senast (${dayName(now.formation_news[0].date)}): ${now.formation_news[0].title}.`,
      ),
    )
  if (chosen && focusPoll && focusPrev)
    attention.push(
      l(
        `${partyName(focus)} has ${pct(focusPoll.share_pct)} in SCB’s survey of ${monthName(latestMonth)}, ${signed(focusPoll.share_pct - focusPrev.share_pct, 1)} points since ${monthName(prevMonth)}.`,
        `${partyName(focus)} har ${pct(focusPoll.share_pct)} i SCB:s mätning ${monthName(latestMonth)}, ${signed(focusPoll.share_pct - focusPrev.share_pct, 1)} procentenheter sedan ${monthName(prevMonth)}.`,
      ),
    )
  else if (mover)
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

  const p = identity(focus)
  let seatOffset = 0
  const seatOrder = [
    ...seated.filter((s) => gov?.government_parties.includes(s.party)),
    ...seated.filter((s) => gov?.agreement_parties?.includes(s.party)),
    ...seated.filter((s) => !side.includes(s.party)),
  ]

  return (
    <div className="dash" data-party={chosen ?? undefined}>
      <header className="dash-head">
        <div>
          <h1>
            {l('Where things stand', 'Läget just nu')}
            {chosen && (
              <span className="dash-focus" style={{ borderColor: p.line }}>
                <PartyLogo party={focus} size={20} />
                {partyName(focus)}
                <button
                  type="button"
                  onClick={() => choose(null)}
                  aria-label={l('Show all parties', 'Visa alla partier')}
                >
                  ×
                </button>
              </span>
            )}
          </h1>
          <p className="dash-sub">
            {l('Updated', 'Uppdaterad')} {dayName(now.generated_at)} ·{' '}
            {chosen
              ? l(
                  'Every card shows the chosen party.',
                  'Alla kort visar valt parti.',
                )
              : l(
                  'Choose a party on the left to focus every card on it.',
                  'Välj ett parti till vänster så visar alla kort det partiet.',
                )}
          </p>
        </div>
        {chosen && (
          <a
            className="dash-partylink"
            href={`#parties-${focus.toLowerCase()}`}
          >
            {l(`Everything about ${focus}`, `Allt om ${focus}`)} →
          </a>
        )}
      </header>

      <dl className="dash-kpis">
        {chosen ? (
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
              value={record?.with_government_pct ?? 0}
              format={(v) => pct(v, 0)}
              sub={lastSession?.session}
            />
            <Kpi
              index={4}
              label={l('Party unity', 'Partiets enighet')}
              value={record?.cohesion_pct ?? 0}
              format={(v) => pct(v, 1)}
              sub={lastSession?.session}
            />
            <Kpi
              index={5}
              label={l('In the news, 30 days', 'I nyheterna, 30 dagar')}
              value={news?.party_counts_30d[focus] ?? 0}
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
              value={pollOf(largest?.party ?? 'S', latestMonth)?.share_pct ?? 0}
              format={(v) => `${largest?.party} ${pct(v, 1)}`}
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

      <section className="dash-attention" aria-labelledby="dash-attention">
        <h2 id="dash-attention">
          {l('Worth keeping an eye on', 'Att hålla koll på')}
        </h2>
        <ul>
          {attention.slice(0, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <div className="dash-grid">
        <Card
          index={0}
          title={l('Seats in the Riksdag', 'Mandat i riksdagen')}
          meta={l(
            `Election ${now.election.year} · line at ${majority}`,
            `Valet ${now.election.year} · linjen vid ${majority}`,
          )}
          href="#now-seats"
        >
          <div
            className="dash-seats"
            role="img"
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
                    chosen && chosen !== s.party ? 'dash-seat dim' : 'dash-seat'
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
                  onClick={() => choose(chosen === s.party ? null : s.party)}
                  aria-label={`${partyName(s.party)}: ${s.seats} ${l('seats', 'mandat')}`}
                  aria-pressed={chosen === s.party}
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
          </dl>
        </Card>

        <Card
          index={1}
          title={l('What voters think', 'Vad väljarna tycker')}
          meta={l(
            `SCB PSU, per cent · 2014–${latestMonth.slice(0, 4)}`,
            `SCB:s PSU, procent · 2014–${latestMonth.slice(0, 4)}`,
          )}
          href={`#politik-valjarna${chosen ? `?partier=${chosen}` : ''}`}
        >
          {polls ? (
            <MiniLines
              series={pollSeries}
              focus={chosen}
              format={(v) => `${num(v)} %`}
              label={l(
                'Support per party over time',
                'Stöd per parti över tid',
              )}
            />
          ) : (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          )}
        </Card>

        <Card
          index={2}
          title={l(`Who ${focus} votes like`, `Vilka ${focus} röstar som`)}
          meta={l(
            `Share of roll calls with the same position · ${lastSession?.session ?? ''}`,
            `Andel voteringar med samma ståndpunkt · ${lastSession?.session ?? ''}`,
          )}
          href={`#politik-roster?parti=${focus}`}
        >
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
              `How often ${partyName(focus)} voted like each party`,
              `Hur ofta ${partyName(focus)} röstade som varje parti`,
            )}
          />
        </Card>

        <Card
          index={3}
          title={l(
            `${focus}’s budget compared with the government`,
            `${focus}:s budget jämfört med regeringen`,
          )}
          meta={
            budgetYear
              ? l(
                  `SEK m, largest differences · budget year ${budgetYear} · net ${signed(budgetNet)}`,
                  `Mnkr, största skillnaderna · budgetåret ${budgetYear} · netto ${signed(budgetNet)}`,
                )
              : l(
                  'No budget of its own in the data',
                  'Ingen egen budget i datan',
                )
          }
          href={`#politik-budget?parti=${focus}${budgetYear ? `&ar=${budgetYear}` : ''}`}
        >
          {budgetShown.length ? (
            <DashBars
              bars={budgetShown.map((r) => ({
                key: String(r.expenditure_area),
                label:
                  names.get(r.expenditure_area) ?? String(r.expenditure_area),
                value: r.deviation_msek,
                party: focus,
              }))}
              format={(v) => signed(v)}
              label={l(
                'Difference from the government per area',
                'Skillnad mot regeringen per område',
              )}
            />
          ) : (
            <p className="dash-empty">
              {report
                ? l(
                    `${partyName(focus)} has not tabled an alternative budget in the years covered: it has been in or supporting government.`,
                    `${partyName(focus)} har inte lagt någon egen budget under åren i datan: partiet har suttit i eller stött regeringen.`,
                  )
                : l('Loading…', 'Laddar…')}
            </p>
          )}
        </Card>

        <Card
          index={4}
          title={l(
            `What ${focus} talks about most`,
            `Vad ${focus} pratar mest om`,
          )}
          meta={l(
            `Share of issue words · all issue debates · ${talkSession}`,
            `Andel av ämnesorden · alla sakdebatter · ${talkSession}`,
          )}
          href={`#politik-tal${chosen ? `?partier=${chosen}` : ''}`}
        >
          {talkTop.length ? (
            <DashBars
              bars={talkTop.map((r) => ({
                key: String(r.expenditure_area),
                label:
                  names.get(r.expenditure_area) ?? String(r.expenditure_area),
                value: r.keyword_share_pct,
                tone: 'neutral',
              }))}
              format={(v) => pct(v, 1)}
              label={l(
                'Share of issue words per area',
                'Andel ämnesord per område',
              )}
            />
          ) : (
            <p className="dash-empty">{l('Loading…', 'Laddar…')}</p>
          )}
        </Card>

        <Card
          index={5}
          title={
            chosen
              ? l(`${focus} in the news`, `${focus} i nyheterna`)
              : l('Latest political news', 'Senaste politiska nyheterna')
          }
          meta={l(
            'SVT, Ekot and the Government Offices',
            'SVT, Ekot och Regeringskansliet',
          )}
          href="#now-news"
        >
          <ol className="dash-news">
            {newsItems.map((item, i) => (
              <li key={item.id} style={{ ['--i' as string]: i }}>
                <time dateTime={item.published_at}>
                  {new Date(item.published_at).toLocaleString('sv-SE', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <span className="dash-news-parties">
                  {item.parties.slice(0, 4).map((code) => (
                    <PartyLogo
                      key={code}
                      party={code}
                      size={14}
                      decorative={false}
                    />
                  ))}
                </span>
              </li>
            ))}
            {news && newsItems.length === 0 && (
              <li className="dash-empty">
                {l('No items yet.', 'Inga nyheter ännu.')}
              </li>
            )}
          </ol>
        </Card>
      </div>
      <p className="dash-foot">
        {l('Sources', 'Källor')}: Valmyndigheten, SCB,{' '}
        {l('the Riksdag', 'riksdagen')}, Regeringskansliet, SVT, Ekot ·{' '}
        <a href="#politik-kallor">
          {l('Sources and method', 'Källor och metod')}
        </a>
      </p>
    </div>
  )
}
