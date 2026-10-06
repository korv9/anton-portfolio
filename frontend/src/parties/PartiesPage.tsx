/**
 * The parties: a card for each in its colour and logo, and for each party everything the site
 * has on it, from the same files as the other politics pages: elections and polls, the
 * governments it sat in or supported, its voting record, who it votes with, how it voted on
 * the tax decisions, and where it stands on each issue.
 */
import { useEffect, useMemo, useState } from 'react'
import TopicNav from '../TopicNav'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import {
  load,
  percent,
  sessionDate,
  type Elections,
  type Issues,
  type Now,
  type Sessions,
} from '../parliament/data'
import type { Decisions as TaxDecisions } from '../taxes/Decisions'
import {
  PartyLogo,
  PartyTag,
  RIKSDAG_PARTIES,
  identity,
  partyLine,
  partyName,
} from './identity'
import '../welfare/welfare.css'
import '../parliament/parliament.css'
import './parties.css'
import { NewsList, useNews } from '../parliament/News'

type Poll = { survey_month: string; party: string; share_pct: number }
type Data = {
  now: Now
  elections: Elections
  sessions: Sessions
  polls: Poll[]
  issues: Issues
  taxes: TaxDecisions | null
}

const signed = (value: number, digits = 1) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toLocaleString(
    'sv-SE',
    { minimumFractionDigits: digits, maximumFractionDigits: digits },
  )}`
const month = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })

const ROLE: Record<string, [string, string]> = {
  government: ['In government', 'I regeringen'],
  agreement: ['Supports the government', 'Stödparti till regeringen'],
  opposition: ['Opposition', 'Opposition'],
}

function roleNow(now: Now, party: string) {
  if (now.government.government_parties.includes(party)) return 'government'
  if (now.government.agreement_parties?.includes(party)) return 'agreement'
  return 'opposition'
}

export default function PartiesPage({ view }: { view: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([
      load<Now>('parliament/now.json'),
      load<Elections>('parliament/elections.json'),
      load<Sessions>('parliament/sessions.json'),
      load<{ polls: Poll[] }>('parliament/polls.json'),
      load<Issues>('parliament/issues.json'),
      load<TaxDecisions>('taxes/decisions.json').catch(() => null),
    ])
      .then(([now, elections, sessions, polls, issues, taxes]) =>
        setData({
          now,
          elections,
          sessions,
          polls: polls.polls,
          issues,
          taxes,
        }),
      )
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const code = view.startsWith('#parties-')
    ? view.slice('#parties-'.length).toUpperCase()
    : null
  const party = code && RIKSDAG_PARTIES.includes(code) ? code : null

  return (
    <div className="project-page welfare-page parties-page">
      <div className="page-lead">
        <p className="eyebrow">{l('Swedish politics', 'Svensk politik')}</p>
        <h1>{l('The parties', 'Partierna')}</h1>
        <p>
          {l(
            'The eight parties in the Riksdag. Choose one to see everything on it in one place: election results and polls, the governments it sat in, how it votes and with whom, its votes on tax decisions, and where it stands on each issue.',
            'De åtta partierna i riksdagen. Välj ett för att se allt om det på ett ställe: valresultat och opinion, regeringarna det har suttit i, hur det röstar och med vilka, dess röster om skattebeslut och var det står i varje sakfråga.',
          )}
        </p>
        {party && (
          <TopicNav
            active={`#parties-${party.toLowerCase()}`}
            items={[
              ['#parties', 'All parties', 'Alla partier'],
              ...RIKSDAG_PARTIES.map(
                (p) =>
                  [`#parties-${p.toLowerCase()}`, p, p] as [
                    string,
                    string,
                    string,
                  ],
              ),
            ]}
          />
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}
      {data && !party && <PartyCards data={data} />}
      {data && party && <PartyDetail data={data} party={party} />}
    </div>
  )
}

function PartyCards({ data }: { data: Data }) {
  const { now } = data
  const parties = [...RIKSDAG_PARTIES].sort(
    (a, b) =>
      (now.election.parties.find((p) => p.party === b)?.share_pct ?? 0) -
      (now.election.parties.find((p) => p.party === a)?.share_pct ?? 0),
  )
  return (
    <section
      className="report welfare-section"
      aria-label={l('Choose a party', 'Välj parti')}
    >
      <ul className="party-cards" data-testid="party-cards">
        {parties.map((code) => {
          const p = identity(code)
          const result = now.election.parties.find((r) => r.party === code)
          const poll = now.poll.parties.find((r) => r.party === code)
          const role = roleNow(now, code)
          return (
            <li key={code}>
              <a
                className="party-card"
                href={`#parties-${code.toLowerCase()}`}
                style={{ background: p.color, color: p.ink }}
                data-party={code}
              >
                <span className="party-card-logo">
                  <PartyLogo party={code} size={56} />
                </span>
                <span className="party-card-name">
                  <strong>{p.name}</strong>
                  <small>{code}</small>
                </span>
                <span className="party-card-facts">
                  {result && (
                    <span>
                      <b>{percent(result.share_pct, 1)}</b> {l('in', 'i valet')}{' '}
                      {l(
                        `the ${now.election.year} election`,
                        `${now.election.year}`,
                      )}
                      {' · '}
                      {result.seats} {l('seats', 'mandat')}
                    </span>
                  )}
                  {poll && (
                    <span>
                      <b>{percent(poll.share_pct, 1)}</b> {l('in', 'i')} PSU{' '}
                      {month(now.poll.survey_month)}
                    </span>
                  )}
                  <span className="party-card-role">{l(...ROLE[role])}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="welfare-note">
        {l(
          'Colours are the party colours as Swedish media draw them; logos as the Riksdag shows them. Role as of the current government, ',
          'Färgerna är partifärgerna så som svenska medier ritar dem; logotyperna så som riksdagen visar dem. Roll enligt nuvarande regering, ',
        )}
        {now.government.government_name}.
      </p>
    </section>
  )
}

function PartyDetail({ data, party }: { data: Data; party: string }) {
  const { now, elections, sessions, polls, issues, taxes } = data
  const p = identity(party)
  const result = now.election.parties.find((r) => r.party === party)
  const poll = now.poll.parties.find((r) => r.party === party)
  const role = roleNow(now, party)

  const results = elections.results
    .filter((r) => r.party === party && r.share_pct != null)
    .sort((a, b) => a.election_year - b.election_year)
  const best = results.reduce<(typeof results)[number] | null>(
    (top, r) => (!top || r.share_pct! > top.share_pct! ? r : top),
    null,
  )

  const support: Series[] = [
    {
      key: 'election',
      name: l('Election result', 'Valresultat'),
      points: results.map((r) => ({
        date: `${r.election_year}-09-15`,
        label: `${l('Election', 'Val')} ${r.election_year}`,
        value: r.share_pct!,
      })),
    },
    {
      key: 'poll',
      name: l('SCB party preference survey', 'SCB:s partisympatiundersökning'),
      points: polls
        .filter((q) => q.party === party)
        .map((q) => ({
          date: q.survey_month,
          label: month(q.survey_month),
          value: q.share_pct,
        })),
    },
  ]

  // Governments by the sessions they sat through: in government, supporting, or neither.
  const governments = useMemo(() => {
    const out: {
      name: string
      from: string
      to: string
      role: 'government' | 'agreement'
      sessions: number
    }[] = []
    for (const s of sessions.sessions) {
      const r = s.government_parties.includes(party)
        ? 'government'
        : s.agreement_parties?.includes(party)
          ? 'agreement'
          : null
      if (!r) continue
      const last = out.at(-1)
      if (last && last.name === s.government_name && last.role === r) {
        last.to = s.session
        last.sessions += 1
      } else
        out.push({
          name: s.government_name,
          from: s.session,
          to: s.session,
          role: r,
          sessions: 1,
        })
    }
    return out
  }, [sessions, party])

  const record = sessions.party_record
    .filter((r) => r.party === party)
    .sort((a, b) => a.session.localeCompare(b.session))
  const latestSession = record.at(-1)?.session
  const pairs = sessions.party_pairs
    .filter(
      (pair) =>
        pair.session === latestSession &&
        (pair.party_a === party || pair.party_b === party),
    )
    .map((pair) => ({
      other: pair.party_a === party ? pair.party_b : pair.party_a,
      agreement: pair.agreement_pct,
      roll_calls: pair.comparable_roll_calls,
    }))
    .filter((pair) => RIKSDAG_PARTIES.includes(pair.other))
    .sort((a, b) => b.agreement - a.agreement)

  const recordSeries: Series[] = [
    {
      key: 'with_government',
      name: l('Voted as the government', 'Röstade som regeringen'),
      points: record
        .filter((r) => r.with_government_pct != null)
        .map((r) => ({
          date: sessionDate(r.session),
          label: `${r.session} · ${l(...ROLE[r.role])}`,
          value: r.with_government_pct!,
        })),
    },
  ]

  const taxVotes = (taxes?.decisions ?? [])
    .filter((d) => d.vote?.parties[party])
    .map((d) => {
      const [position] = d.vote!.parties[party]
      const stance =
        position === 'yes' || position === 'no'
          ? position === d.vote!.outcome
            ? 'for'
            : 'against'
          : position
      return { d, stance }
    })
    .sort((a, b) => b.d.in_force.localeCompare(a.d.in_force))
  const [allTaxes, setAllTaxes] = useState(false)
  const taxFor = taxVotes.filter((v) => v.stance === 'for').length
  const taxAgainst = taxVotes.filter((v) => v.stance === 'against').length

  const issueRows = issues.issues
    .map((issue) => ({
      issue,
      row: issue.parties.find((r) => r.party === party),
      speeches: issue.speeches
        .filter((s) => s.party === party)
        .reduce((sum, s) => sum + s.speeches, 0),
    }))
    .filter((x) => x.row)
    .sort(
      (a, b) =>
        (b.row!.with_government_pct ?? 0) - (a.row!.with_government_pct ?? 0),
    )

  const recent = now.latest_decisions.filter((d) => d.party_positions?.[party])

  return (
    <>
      <div className="party-hero-wrap">
        <section
          className="party-hero"
          style={{ background: p.color, color: p.ink }}
          data-testid="party-hero"
          aria-labelledby="party-heading"
        >
          <span className="party-hero-logo">
            <PartyLogo party={party} size={96} />
          </span>
          <div>
            <p className="eyebrow">
              {party} · {l(...ROLE[role])}
            </p>
            <h2 id="party-heading">{p.name}</h2>
            <p>
              {l(p.nameEn, p.name)}
              {p.founded && ` · ${l('founded', 'grundat')} ${p.founded}`}
              {p.website && (
                <>
                  {' · '}
                  <a href={p.website} style={{ color: p.ink }}>
                    {p.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </>
              )}
            </p>
          </div>
        </section>
      </div>

      <section
        className="report welfare-section"
        aria-label={l('In short', 'I korthet')}
      >
        <ul className="party-facts" data-testid="party-facts">
          {result && (
            <li>
              <strong>{percent(result.share_pct, 1)}</strong>
              <span>
                {l('Election', 'Valet')} {now.election.year} · {result.seats}{' '}
                {l('seats', 'mandat')}
                {result.previous_share_pct != null &&
                  result.share_pct != null &&
                  ` · ${signed(result.share_pct - result.previous_share_pct)} p.e.`}
              </span>
            </li>
          )}
          {poll && (
            <li>
              <strong>{percent(poll.share_pct, 1)}</strong>
              <span>PSU {month(now.poll.survey_month)}</span>
            </li>
          )}
          {best && (
            <li>
              <strong>{percent(best.share_pct, 1)}</strong>
              <span>
                {l('Best election since', 'Bästa val sedan')}{' '}
                {elections.years[0]}: {best.election_year}
              </span>
            </li>
          )}
          <li>
            <strong>
              {governments
                .filter((g) => g.role === 'government')
                .reduce((sum, g) => sum + g.sessions, 0)}
            </strong>
            <span>
              {l(
                `of ${sessions.sessions.length} sessions in government since ${sessions.sessions[0]?.session}`,
                `av ${sessions.sessions.length} riksmöten i regeringen sedan ${sessions.sessions[0]?.session}`,
              )}
            </span>
          </li>
          {taxVotes.length > 0 && (
            <li>
              <strong>
                {taxFor}/{taxFor + taxAgainst}
              </strong>
              <span>
                {l(
                  'tax decisions it voted for',
                  'skattebeslut partiet röstade för',
                )}
              </span>
            </li>
          )}
        </ul>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="party-support"
      >
        <p className="eyebrow">{l('Support', 'Stöd')}</p>
        <h2 id="party-support">
          {l('Elections and polls', 'Val och opinionsmätningar')}
        </h2>
        <MultiLineChart
          series={support}
          label={l('Support over time', 'Stöd över tid')}
          format={(v) => percent(v, 1)}
          colorOf={(key) => (key === 'election' ? p.line : '#8a8f8c')}
        />
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="party-governments"
      >
        <p className="eyebrow">{l('Power', 'Makt')}</p>
        <h2 id="party-governments">
          {l(
            'Governments it sat in or supported',
            'Regeringar partiet satt i eller stödde',
          )}
        </h2>
        {governments.length === 0 ? (
          <p>
            {l(
              `Not in or supporting a government in any session since ${sessions.sessions[0]?.session}.`,
              `Inte i eller stödparti till någon regering under något riksmöte sedan ${sessions.sessions[0]?.session}.`,
            )}
          </p>
        ) : (
          <ol className="party-governments" data-testid="party-governments">
            {governments.map((g) => (
              <li key={`${g.name}-${g.from}-${g.role}`}>
                <span
                  className="party-government-mark"
                  style={{
                    background:
                      g.role === 'government' ? p.color : 'transparent',
                    borderColor: p.line,
                  }}
                />
                <strong>{g.name}</strong>
                <span>
                  {g.from === g.to ? g.from : `${g.from}–${g.to}`} ·{' '}
                  {l(...ROLE[g.role])}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="party-record"
      >
        <p className="eyebrow">{l('In the chamber', 'I kammaren')}</p>
        <h2 id="party-record">
          {l(
            'How it votes, and with whom',
            'Hur partiet röstar, och med vilka',
          )}
        </h2>
        <MultiLineChart
          series={recordSeries}
          label={l(
            'Share of roll calls voting as the government',
            'Andel voteringar där partiet röstade som regeringen',
          )}
          format={(v) => percent(v, 0)}
          colorOf={() => p.line}
        />
        {pairs.length > 0 && (
          <>
            <h3 className="analysis-subhead">
              {l(
                'Agreement with the other parties',
                'Samstämmighet med de andra partierna',
              )}{' '}
              · {latestSession}
            </h3>
            <ul className="party-pairs" data-testid="party-pairs">
              {pairs.map((pair) => (
                <li key={pair.other}>
                  <a href={`#parties-${pair.other.toLowerCase()}`}>
                    <PartyTag party={pair.other} />
                  </a>
                  <span className="party-pair-track">
                    <span
                      className="party-pair-bar"
                      style={{
                        width: `${pair.agreement}%`,
                        background: partyLine(pair.other),
                      }}
                    />
                  </span>
                  <span className="party-pair-value">
                    {percent(pair.agreement, 0)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="welfare-note">
              {l(
                'Share of roll calls where both parties voted yes or no and took the same position.',
                'Andel voteringar där båda partierna röstade ja eller nej och tog samma ståndpunkt.',
              )}
            </p>
          </>
        )}
        <div className="table-scroll">
          <table className="welfare-table compact" data-testid="party-record">
            <thead>
              <tr>
                <th>{l('Session', 'Riksmöte')}</th>
                <th>{l('Role', 'Roll')}</th>
                <th>{l('Roll calls', 'Voteringar')}</th>
                <th>{l('Attendance', 'Närvaro')}</th>
                <th>{l('Cohesion', 'Sammanhållning')}</th>
                <th>{l('On winning side', 'På vinnande sida')}</th>
              </tr>
            </thead>
            <tbody>
              {record
                .slice(-8)
                .reverse()
                .map((r) => (
                  <tr key={r.session}>
                    <td>{r.session}</td>
                    <td>{l(...ROLE[r.role])}</td>
                    <td>{r.roll_calls}</td>
                    <td>{percent(r.attendance_pct, 0)}</td>
                    <td>{percent(r.cohesion_pct, 0)}</td>
                    <td>{percent(r.on_winning_side_pct, 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {taxVotes.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="party-taxes"
        >
          <p className="eyebrow">{l('Taxes', 'Skatter')}</p>
          <h2 id="party-taxes">
            {l('Its votes on tax decisions', 'Partiets röster om skattebeslut')}
          </h2>
          <ul className="party-tax-votes" data-testid="party-tax-votes">
            {(allTaxes ? taxVotes : taxVotes.slice(0, 12)).map(
              ({ d, stance }) => (
                <li key={d.key}>
                  <span
                    className={`position ${stance === 'for' ? 'yes' : stance === 'against' ? 'no' : 'abstain'}`}
                  >
                    {stance === 'for'
                      ? l('for', 'för')
                      : stance === 'against'
                        ? l('against', 'emot')
                        : stance === 'abstain'
                          ? l('abstained', 'avstod')
                          : l('absent', 'frånvarande')}
                  </span>
                  <span>
                    <strong>{l(d.title_en, d.title_sv)}</strong>
                    <small>
                      {' '}
                      · {d.in_force.slice(0, 4)} ·{' '}
                      {d.direction === 'lower'
                        ? l('lower tax', 'sänkt skatt')
                        : l('higher tax', 'höjd skatt')}
                    </small>
                  </span>
                </li>
              ),
            )}
          </ul>
          {taxVotes.length > 12 && (
            <button
              type="button"
              className="compact-toggle"
              onClick={() => setAllTaxes((v) => !v)}
            >
              {allTaxes
                ? l('Show fewer', 'Visa färre')
                : l(
                    `Show all ${taxVotes.length}`,
                    `Visa alla ${taxVotes.length}`,
                  )}
            </button>
          )}
          <p>
            <a href="#taxes-decisions">
              {l(
                'All tax decisions, with every party’s vote and the studies behind them',
                'Alla skattebeslut, med alla partiers röster och utredningarna bakom',
              )}
            </a>
          </p>
        </section>
      )}

      <section
        className="report welfare-section"
        aria-labelledby="party-issues"
      >
        <p className="eyebrow">{l('Issues', 'Sakfrågor')}</p>
        <h2 id="party-issues">
          {l(
            'Where it stands, issue by issue',
            'Var partiet står, fråga för fråga',
          )}
        </h2>
        <div className="table-scroll">
          <table className="welfare-table compact" data-testid="party-issues">
            <thead>
              <tr>
                <th>{l('Issue', 'Sakfråga')}</th>
                <th>{l('Decisions', 'Beslut')}</th>
                <th>
                  {l('Voted as the government', 'Röstade som regeringen')}
                </th>
                <th>{l('Speeches', 'Anföranden')}</th>
              </tr>
            </thead>
            <tbody>
              {issueRows.map(({ issue, row, speeches }) => (
                <tr key={issue.issue_key}>
                  <td>
                    <a href={`#issue-${issue.issue_key}`}>
                      {l(issue.issue_name_en, issue.issue_name_sv)}
                    </a>
                  </td>
                  <td>{row!.decisions}</td>
                  <td>
                    <span
                      className="cell-bar"
                      style={{
                        width: `${row!.with_government_pct ?? 0}%`,
                        background: p.line,
                      }}
                    />
                    {percent(row!.with_government_pct, 0)}
                  </td>
                  <td>{speeches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="welfare-note">
          {l(
            `Decisions under the current government; for a governing party this is close to 100 %. ${partyName(party)} in the debates since 1993.`,
            `Beslut under nuvarande regering; för ett regeringsparti är detta nära 100 %. Anföranden: ${partyName(party)} i debatterna sedan 1993.`,
          )}
        </p>
      </section>

      <PartyNews party={party} />

      {recent.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="party-recent"
        >
          <p className="eyebrow">{l('Latest', 'Senast')}</p>
          <h2 id="party-recent">
            {l('Its latest votes', 'Partiets senaste röster')}
          </h2>
          <ul className="party-tax-votes">
            {recent.map((d) => {
              const position = d.party_positions![party]
              return (
                <li key={d.roll_call_id}>
                  <span className={`position ${position}`}>
                    {position === 'yes'
                      ? l('yes', 'ja')
                      : position === 'no'
                        ? l('no', 'nej')
                        : position === 'abstain'
                          ? l('abstained', 'avstod')
                          : position}
                  </span>
                  <span>
                    {d.report_url ? (
                      <a href={d.report_url}>{d.title ?? d.designation}</a>
                    ) : (
                      (d.title ?? d.designation)
                    )}
                    <small>
                      {' '}
                      · {d.vote_date} · {d.session}:{d.designation} p. {d.point}
                    </small>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

/** The latest news naming the party. */
function PartyNews({ party }: { party: string }) {
  const { news } = useNews()
  if (!news) return null
  const items = news.items.filter((i) => i.parties.includes(party)).slice(0, 8)
  return (
    <section className="report welfare-section" aria-labelledby="party-news">
      <p className="eyebrow">{l('In the news', 'I nyheterna')}</p>
      <h2 id="party-news">
        {l(
          `${partyName(party)} in the news`,
          `${partyName(party)} i nyheterna`,
        )}
      </h2>
      <div data-testid="party-news">
        <NewsList news={news} items={items} />
      </div>
      <p>
        <a href="#now-news">
          {l(
            'All political news from SVT, Ekot and the Government',
            'Alla politiska nyheter från SVT, Ekot och Regeringen',
          )}
        </a>
      </p>
    </section>
  )
}
