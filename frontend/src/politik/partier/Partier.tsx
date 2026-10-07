/**
 * Partier: a card for each party with its logo and where it stands, and below a chosen party a
 * dashboard of everything the site knows about it: who sits in the Riksdag for it, where it
 * holds seats in the municipal councils, its elections since 1973 and the latest surveys, how
 * it votes and with whom, its budget motions, its part in the party-leader debates and what it
 * talks about.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import {
  load,
  type Elections,
  type Now,
  type Sessions,
} from '../../parliament/data'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  identity,
  partyName,
} from '../../parties/identity'
import SeatHistory from '../features/SeatHistory'
import type { Route } from '../../router'
import { useParties, withParties } from '../partySelection'
import { dayName, num, pct, signed } from '../controls'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Columns from '../board/Columns'
import RankBars from '../../charts/RankBars'
import {
  budgetBasis,
  loadBudgetReport,
  type BudgetReport,
} from '../themes/BudgetTheme'
import { loadDebateIndex, totalFor, type DebateIndex } from '../debatter/data'
import './partier.css'

type Summary = {
  members: number
  on_leave: number
  women: number
  leaders: { name: string; post: string }[]
  ministers: { name: string; post: string }[]
  council_seats: number
  council_seats_before: number
  council_municipalities: number
  council_largest: number
}
type PartyIndex = {
  generated_at: string
  sources: {
    members: { url: string; as_of: string }
    councils: {
      url: string
      election: string
      municipalities: number
      counts: Record<string, number>
    }
  }
  parties: Record<string, Summary>
}
type Member = {
  name: string
  constituency: string
  gender: string
  born: number | null
  photo: string
  on_leave: boolean
  committees: string[]
  party_posts: string[]
  minister: string | null
  url: string
}
type Council = {
  code: string
  name: string
  county: string
  seats: number
  seats_before: number
  total: number
  largest: boolean
}
type Profile = {
  party: string
  members: Member[]
  committees: Record<string, number>
  councils: Council[]
}
type Poll = { survey_month: string; party: string; share_pct: number }
type Topic = {
  session: string
  topic_id: number
  topic_label: string
  word_share_pct: number
}

type Shared = {
  index: PartyIndex
  now: Now
  elections: Elections
  polls: Poll[]
  sessions: Sessions
}

const ROLE = (now: Now, p: string) =>
  now.government.government_parties.includes(p)
    ? l('In government', 'I regeringen')
    : now.government.agreement_parties?.includes(p)
      ? l('Supports the government', 'Stödparti')
      : l('Opposition', 'Opposition')

export default function Partier({ route }: { route: Route }) {
  // The chosen party is the party bar's choice (the last one chosen), so the bar and the cards
  // always agree and the choice follows the reader to the other pages.
  const { selected, set } = useParties(route)
  const [shared, setShared] = useState<Shared | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([
      load<PartyIndex>('politics/parties/index.json'),
      load<Now>('parliament/now.json'),
      load<Elections>('parliament/elections.json'),
      load<{ polls: Poll[] }>('parliament/polls.json'),
      load<Sessions>('parliament/sessions.json'),
    ])
      .then(([index, now, elections, polls, sessions]) =>
        setShared({ index, now, elections, polls: polls.polls, sessions }),
      )
      .catch((e: Error) => setError(e.message))
  }, [])

  const party = selected.at(-1) ?? ''

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!shared) return <Empty />
  const { index, now, polls } = shared
  const months = [...new Set(polls.map((p) => p.survey_month))].sort()
  const latestMonth = months.at(-1) ?? ''
  const seatsOf = (p: string) => now.election.parties.find((r) => r.party === p)

  return (
    <Board
      title={party ? partyName(party) : l('The parties', 'Partierna')}
      sub={
        party
          ? `${ROLE(now, party)} · ${
              selected.length > 1
                ? l(
                    `${selected.length} parties are chosen; this shows the last one. Click a card to show only that party.`,
                    `${selected.length} partier är valda; här visas det senast valda. Klicka på ett kort för att bara visa det.`,
                  )
                : l(
                    'everything about the party on one page. Click the card again to see all parties.',
                    'allt om partiet på en sida. Klicka på kortet igen för att se alla partier.',
                  )
            }`
          : l(
              'The eight parties in the Riksdag. Choose one for a dashboard of its members, councils, elections, votes and debates.',
              'De åtta riksdagspartierna. Välj ett för en dashboard med ledamöter, kommunfullmäktige, val, röster och debatter.',
            )
      }
    >
      <SeatHistory party={party} />
      <ul
        className={party ? 'party-cards compact' : 'party-cards'}
        aria-label={l('Parties', 'Partier')}
      >
        {RIKSDAG_PARTIES.map((p, i) => {
          const s = index.parties[p]
          const result = seatsOf(p)
          const poll = polls.find(
            (x) => x.party === p && x.survey_month === latestMonth,
          )
          return (
            <li key={p} style={{ ['--i' as string]: i }}>
              <a
                href={withParties('#politik-partier', [p])}
                aria-current={p === party ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  set(p === party && selected.length === 1 ? [] : [p])
                }}
                style={{ borderTopColor: identity(p).color }}
              >
                <PartyLogo party={p} size={party ? 28 : 44} />
                <span className="pcard-name">{partyName(p)}</span>
                {!party && (
                  <>
                    <span className="pcard-role">{ROLE(now, p)}</span>
                    <dl>
                      <div>
                        <dt>{l('Seats', 'Mandat')}</dt>
                        <dd>{result?.seats ?? '–'}</dd>
                      </div>
                      <div>
                        <dt>PSU</dt>
                        <dd>{poll ? pct(poll.share_pct) : '–'}</dd>
                      </div>
                      <div>
                        <dt>{l('Councils', 'Kommuner')}</dt>
                        <dd>{s ? `${s.council_municipalities}/290` : '–'}</dd>
                      </div>
                    </dl>
                    {s?.leaders.length ? (
                      <span className="pcard-leader">
                        {s.leaders.map((x) => x.name).join(' · ')}
                      </span>
                    ) : null}
                  </>
                )}
              </a>
            </li>
          )
        })}
      </ul>
      {party && <PartyDashboard key={party} party={party} shared={shared} />}
    </Board>
  )
}

function PartyDashboard({ party, shared }: { party: string; shared: Shared }) {
  const { index, now, sessions } = shared
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<BudgetReport | null>(null)
  const [debates, setDebates] = useState<DebateIndex | null>(null)
  const [topics, setTopics] = useState<Topic[] | null>(null)
  useEffect(() => {
    load<Profile>(`politics/parties/${party.toLowerCase()}.json`)
      .then(setProfile)
      .catch(() => {})
    loadBudgetReport()
      .then(setReport)
      .catch(() => {})
    loadDebateIndex()
      .then(setDebates)
      .catch(() => {})
    load<{ data: Topic[] }>(
      `politics/parliament/parties/${party.toLowerCase()}/topics.json`,
    )
      .then((t) => setTopics(t.data))
      .catch(() => setTopics([]))
  }, [party])

  const s = index.parties[party]
  const result = now.election.parties.find((r) => r.party === party)
  const lastSessions = sessions.sessions.slice(-8).map((x) => x.session)
  const latestSession = lastSessions.at(-1) ?? ''
  const alike = RIKSDAG_PARTIES.filter((p) => p !== party)
    .map((p) => ({
      party: p,
      value:
        sessions.party_pairs.find(
          (x) =>
            x.session === latestSession &&
            ((x.party_a === party && x.party_b === p) ||
              (x.party_a === p && x.party_b === party)),
        )?.agreement_pct ?? null,
    }))
    .filter((x): x is { party: string; value: number } => x.value != null)
    .sort((a, b) => b.value - a.value)

  // Councils: per county, the strongest municipalities, and the change since the last election.
  const councils = profile?.councils ?? []
  const counties = [...new Set(councils.map((c) => c.county))]
    .map((county) => {
      const rows = councils.filter((c) => c.county === county)
      return {
        county,
        seats: rows.reduce((n, c) => n + c.seats, 0),
        before: rows.reduce((n, c) => n + c.seats_before, 0),
      }
    })
    .sort((a, b) => b.seats - a.seats)
  const strongest = [...councils]
    .filter((c) => c.total)
    .sort((a, b) => b.seats / b.total - a.seats / a.total)
    .slice(0, 12)
  const gained = councils.filter((c) => c.seats > c.seats_before).length
  const lost = councils.filter((c) => c.seats < c.seats_before).length
  const same = councils.length - gained - lost
  const councilYear = index.sources.councils.election
  const preliminary = index.sources.councils.counts['preliminär'] ?? 0

  // Members per constituency.
  const members = profile?.members ?? []
  const constituencies = Object.entries(
    members.reduce<Record<string, number>>((acc, m) => {
      acc[m.constituency] = (acc[m.constituency] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  const budgetYears = report
    ? [...new Set(report.budgets.map((r) => r.budget_year))].sort()
    : []
  const hasBudget = report?.budgets.some((r) => r.actor === party)
  const leaders = (debates?.leaders ?? []).filter(
    (d) => Number(d.date.slice(0, 4)) >= 2014,
  )
  const latestTopics = (() => {
    if (!topics?.length) return []
    const session = [...new Set(topics.map((t) => t.session))].sort().at(-1)
    return topics
      .filter((t) => t.session === session && t.topic_id !== -1)
      .sort((a, b) => b.word_share_pct - a.word_share_pct)
      .slice(0, 8)
  })()
  const topicSession = topics?.length
    ? [...new Set(topics.map((t) => t.session))].sort().at(-1)
    : ''

  return (
    <>
      <Kpis>
        <Kpi
          index={0}
          label={l('Seats in the Riksdag', 'Riksdagsmandat')}
          value={result?.seats ?? 0}
          format={(v) => num(v)}
          sub={
            result?.previous_seats != null
              ? `${signed(result.seats - result.previous_seats)} ${l('since', 'sedan')} ${now.election.year - 4}`
              : undefined
          }
        />
        <Kpi
          index={1}
          label={l(
            `Election ${now.election.year}`,
            `Valet ${now.election.year}`,
          )}
          value={result?.share_pct ?? 0}
          format={(v) => pct(v)}
        />
        <Kpi
          index={3}
          label={l('Council seats', 'Mandat i kommunerna')}
          value={s.council_seats}
          format={(v) => num(v)}
          sub={`${signed(s.council_seats - s.council_seats_before)} ${l('since the last election', 'sedan förra valet')}`}
        />
        <Kpi
          index={4}
          label={l('Sits in', 'Sitter i')}
          value={s.council_municipalities}
          format={(v) => `${num(v)} / 290`}
          sub={l('municipal councils', 'kommunfullmäktige')}
        />
        <Kpi
          index={5}
          label={l('Largest party in', 'Största parti i')}
          value={s.council_largest}
          format={(v) => num(v)}
          sub={l('municipalities', 'kommuner')}
        />
      </Kpis>

      {(s.leaders.length > 0 || s.ministers.length > 0) && (
        <p className="party-people">
          {s.leaders.map((x) => (
            <span key={x.name + x.post}>
              <b>{x.post}:</b> {x.name}
            </span>
          ))}
          {s.ministers.length > 0 && (
            <span>
              <b>{l('Ministers', 'Statsråd')}:</b>{' '}
              {s.ministers
                .map((m) => `${m.name} (${m.post.toLowerCase()})`)
                .join(', ')}
            </span>
          )}
        </p>
      )}

      <Cards>
        <Card
          index={2}
          title={l('In the municipal councils', 'I kommunfullmäktige')}
          meta={l(
            `Municipalities where the party gained, lost or kept its number of seats in ${councilYear}`,
            `Kommuner där partiet fick fler, färre eller lika många mandat ${councilYear}`,
          )}
        >
          {profile ? (
            <Columns
              categories={[
                l('More seats', 'Fler mandat'),
                l('The same', 'Lika många'),
                l('Fewer', 'Färre'),
              ]}
              series={[
                {
                  key: 'n',
                  label: l('Municipalities', 'Kommuner'),
                  values: [gained, same, lost],
                },
              ]}
              format={(v) => num(v)}
              label={l(
                'Change in seats per municipality',
                'Förändring i mandat per kommun',
              )}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={3}
          title={l('Council seats per county', 'Kommunmandat per län')}
          meta={l(
            `Seats in the municipal councils, ${councilYear} · tick: the election before`,
            `Mandat i kommunfullmäktige, ${councilYear} · streck: valet innan`,
          )}
        >
          {profile ? (
            <RankBars
              rows={counties.map((c) => ({
                key: c.county,
                label: c.county,
                value: c.seats,
                party,
                ref: c.before,
                note: ` ${signed(c.seats - c.before)}`,
              }))}
              format={(v) => num(v)}
              label={l('Council seats per county', 'Kommunmandat per län')}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={4}
          title={l('Where the party is strongest', 'Där partiet är starkast')}
          meta={l(
            `Share of the council’s seats, ${councilYear}`,
            `Andel av fullmäktiges mandat, ${councilYear}`,
          )}
        >
          {profile ? (
            <RankBars
              rows={strongest.map((c) => ({
                key: c.code,
                label: c.name,
                value: (c.seats / c.total) * 100,
                party,
                note: ` ${c.seats}/${c.total}`,
              }))}
              format={(v) => pct(v, 0)}
              max={100}
              label={l(
                'The strongest municipalities',
                'De starkaste kommunerna',
              )}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={6}
          title={l('Members per constituency', 'Ledamöter per valkrets')}
          meta={l(
            'The ten constituencies with the most members',
            'De tio valkretsarna med flest ledamöter',
          )}
        >
          {profile ? (
            <RankBars
              rows={constituencies.slice(0, 10).map(([name, n]) => ({
                key: name,
                label: name,
                value: n,
                party,
              }))}
              format={(v) => num(v)}
              label={l('Members per constituency', 'Ledamöter per valkrets')}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={8}
          title={l('Votes most like', 'Röstar oftast som')}
          meta={l(
            `Share of roll calls with the same position, ${latestSession}`,
            `Andel voteringar med samma ståndpunkt, ${latestSession}`,
          )}
        >
          <RankBars
            rows={alike.map((a) => ({
              key: a.party,
              label: `${a.party} · ${partyName(a.party)}`,
              value: a.value,
              party: a.party,
            }))}
            format={(v) => pct(v, 0)}
            max={100}
            label={l(
              'Agreement with each party',
              'Samstämmighet med varje parti',
            )}
          />
        </Card>

        <Card
          index={9}
          title={l('Budget motions', 'Budgetmotioner')}
          meta={l(
            'Net difference against the government’s budget, SEK m, per budget year',
            'Nettoskillnad mot regeringens budget, mnkr, per budgetår',
          )}
          href={`#politik-budget?partier=${party}`}
        >
          {!report ? (
            <Empty />
          ) : hasBudget ? (
            <Columns
              categories={budgetYears.map(String)}
              series={[
                {
                  key: party,
                  label: partyName(party),
                  party,
                  values: budgetYears.map((y) =>
                    report.budgets.some(
                      (r) => r.budget_year === y && r.actor === party,
                    )
                      ? budgetBasis(report, y).net(party)
                      : null,
                  ),
                },
              ]}
              format={(v) => signed(v)}
              label={l(
                'Net difference per budget year',
                'Nettoskillnad per budgetår',
              )}
            />
          ) : (
            <Empty>
              {l(
                'No budget motions of its own in these years: the party was in or supported the government.',
                'Inga egna budgetmotioner dessa år: partiet satt i eller stödde regeringen.',
              )}
            </Empty>
          )}
        </Card>

        <Card
          index={10}
          title={l('In the party-leader debates', 'I partiledardebatterna')}
          meta={l(
            'Speeches and replies per debate since 2014',
            'Anföranden och repliker per debatt sedan 2014',
          )}
          href="#politik-partiledardebatter"
        >
          {debates ? (
            <Columns
              categories={leaders.map((d) =>
                d.date.slice(2, 7).replace('-', '/'),
              )}
              series={[
                {
                  key: party,
                  label: partyName(party),
                  party,
                  values: leaders.map((d) =>
                    d.parties[party] ? totalFor(d.parties, party) : null,
                  ),
                },
              ]}
              format={(v) => num(v)}
              label={l(
                'Part in the party-leader debates',
                'Del i partiledardebatterna',
              )}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={11}
          title={l('What the party talks about', 'Vad partiet pratar om')}
          meta={l(
            `Topics in the party-leader debates, share of the party’s words, ${topicSession}`,
            `Ämnen i partiledardebatterna, andel av partiets ord, ${topicSession}`,
          )}
        >
          {topics == null ? (
            <Empty />
          ) : latestTopics.length ? (
            <RankBars
              rows={latestTopics.map((t) => ({
                key: String(t.topic_id),
                label: t.topic_label,
                value: t.word_share_pct,
              }))}
              format={(v) => pct(v)}
              label={l('Topics', 'Ämnen')}
            />
          ) : (
            <Empty>
              {l('No topics for this party.', 'Inga ämnen för partiet.')}
            </Empty>
          )}
        </Card>

        <Card
          index={12}
          wide
          title={l('The members', 'Ledamöterna')}
          meta={l(
            `${members.length} members of the Riksdag by constituency · the list of people, ${dayName(index.sources.members.as_of)}`,
            `${members.length} riksdagsledamöter efter valkrets · riksdagens personlista, ${dayName(index.sources.members.as_of)}`,
          )}
        >
          {profile ? (
            <ul className="party-members">
              {members.map((m) => (
                <li key={m.url}>
                  <a href={m.url} target="_blank" rel="noreferrer">
                    {m.photo && (
                      <img
                        src={m.photo}
                        alt=""
                        loading="lazy"
                        width={40}
                        height={53}
                        onError={(e) =>
                          (e.currentTarget.style.visibility = 'hidden')
                        }
                      />
                    )}
                    <span>
                      <b>{m.name}</b>
                      <small>{m.constituency}</small>
                      {(m.party_posts.length > 0 ||
                        m.minister ||
                        m.on_leave) && (
                        <small className="party-member-role">
                          {[
                            ...m.party_posts,
                            m.minister,
                            m.on_leave && !m.minister
                              ? l('on leave', 'tjänstledig')
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Card>
      </Cards>

      <p className="dash-foot">
        {l('Sources', 'Källor')}:{' '}
        {l('the Riksdag’s list of people', 'riksdagens personlista')} (
        {dayName(index.sources.members.as_of)}),{' '}
        <a href={index.sources.councils.url} target="_blank" rel="noreferrer">
          Valmyndigheten
        </a>{' '}
        ({l('municipal councils', 'kommunfullmäktige')} {councilYear}
        {preliminary
          ? l(
              `, ${preliminary} municipalities still preliminary`,
              `, ${preliminary} kommuner ännu preliminärt räknade`,
            )
          : ''}
        ), SCB,{' '}
        {l(
          'the Riksdag’s votes and debates',
          'riksdagens voteringar och debatter',
        )}
        .
      </p>
    </>
  )
}
