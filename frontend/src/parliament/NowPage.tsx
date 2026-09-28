import TopicNav from '../TopicNav'
import StudiesView, { StudyLinks } from './Studies'
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import SeatBar from './SeatBar'
import { DecisionDetail } from '../politics/DecisionExplorer'
import LawLibrary from '../politics/LawLibrary'
import '../politics/politics.css'
import PartyPicker, { usePartySlots } from './PartyPicker'
import {
  PARTY_NAMES,
  PARTY_ORDER,
  load,
  partyLabel,
  percent,
  sessionDate,
  type Decision,
  type Elections,
  type Issues,
  type Now,
  type Sessions,
  type SessionRecord,
} from './data'
import '../welfare/welfare.css'
import './parliament.css'

const month = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
const day = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
const signed = (value: number, digits = 1) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toLocaleString(
    'sv-SE',
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    },
  )}`

const POSITION: Record<string, [string, string]> = {
  yes: ['Yes', 'Ja'],
  no: ['No', 'Nej'],
  abstain: ['Abst.', 'Avst.'],
  split: ['Split', 'Delat'],
  absent: ['Absent', 'Frånv.'],
}

/** Plain-language summary of where things stand, written from the data. */
function summary(now: Now) {
  const parties = now.election.parties.filter((p) => p.party !== 'OTHER')
  const largest = [...parties].sort((a, b) => b.seats - a.seats)[0]
  const changes = parties
    .filter((p) => p.previous_share_pct != null && p.share_pct != null)
    .map((p) => ({ ...p, change: p.share_pct! - p.previous_share_pct! }))
    .sort((a, b) => b.change - a.change)
  const gain = changes[0]
  const loss = changes.at(-1)!
  const latest = now.formation_news[0]
  return [
    `Riksdagsvalet ${day(now.election.election_date)}: ${largest.name} blev största parti med ${percent(largest.share_pct, 1)} och ${largest.seats} mandat. ${gain.name} ökade mest (${signed(gain.change)} procentenheter), ${loss.name} minskade mest (${signed(loss.change)}).`,
    now.government.status_note
      ? `${now.government.government_name}: ${now.government.status_note.charAt(0).toLowerCase()}${now.government.status_note.slice(1)}.`
      : `${now.government.government_name} (${now.government.government_parties.join(', ')}) sitter sedan ${day(now.government.start_date)}.`,
    latest
      ? `Senast i regeringsbildningen, ${day(latest.date)}: ${latest.title}.`
      : null,
  ].filter(Boolean) as string[]
}

export function Positions({
  positions,
}: {
  positions: Record<string, string>
}) {
  return (
    <ul
      className="positions"
      aria-label={l('How the parties voted', 'Hur partierna röstade')}
    >
      {PARTY_ORDER.filter((p) => positions[p]).map((party) => (
        <li key={party} className={`position ${positions[party]}`}>
          <strong>{partyLabel(party)}</strong>{' '}
          {l(...(POSITION[positions[party]] ?? ['', '']))}
        </li>
      ))}
    </ul>
  )
}

export function DecisionList({ decisions }: { decisions: Decision[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  return (
    <>
      <ol className="decision-list">
        {(showAll ? decisions : decisions.slice(0, 5)).map((d) => (
          <li key={d.roll_call_id}>
            <div className="decision-head">
              <span className="decision-date">{day(d.vote_date)}</span>
              <span className="decision-ref">
                {d.designation} p. {d.point}
              </span>
              <span className={`decision-outcome ${d.outcome}`}>
                {d.outcome === 'yes'
                  ? l('Adopted', 'Bifall')
                  : d.outcome === 'no'
                    ? l('Rejected', 'Avslag')
                    : l('Tie', 'Lika')}{' '}
                {d.yes}–{d.no}
              </span>
              {d.government_won != null && (
                <span className="decision-gov">
                  {d.government_won
                    ? l('government side won', 'regeringssidan vann')
                    : l('government side lost', 'regeringssidan förlorade')}
                </span>
              )}
            </div>
            <button
              type="button"
              className="decision-title decision-read"
              aria-expanded={selected === d.roll_call_id}
              aria-controls={`decision-${d.roll_call_id}`}
              onClick={() =>
                setSelected(selected === d.roll_call_id ? null : d.roll_call_id)
              }
            >
              {d.title ?? d.designation}{' '}
              <span>
                {selected === d.roll_call_id
                  ? l('Close text ↑', 'Stäng text ↑')
                  : l('Read decision ↓', 'Läs beslut ↓')}
              </span>
            </button>
            {selected === d.roll_call_id && (
              <div
                id={`decision-${d.roll_call_id}`}
                className="inline-decision"
              >
                <DecisionDetail
                  decision={{
                    path: `decisions/${d.session.replace('/', '-')}/${d.roll_call_id}.json`,
                    heading: `${d.designation} · ${l('Point', 'Punkt')} ${d.point}`,
                    title: d.title ?? d.designation,
                    designation: d.designation,
                    point: Number(d.point),
                    date: d.vote_date,
                  }}
                />
              </div>
            )}
            {d.party_positions && <Positions positions={d.party_positions} />}
            <StudyLinks studies={d.studies} />
          </li>
        ))}
      </ol>
      {decisions.length > 5 && (
        <button
          type="button"
          className="compact-toggle"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? l('Show fewer decisions', 'Visa färre beslut')
            : l(
                `Show all ${decisions.length} decisions`,
                `Visa alla ${decisions.length} beslut`,
              )}
        </button>
      )}
    </>
  )
}

const RECORD_MEASURES: { key: keyof SessionRecord; label: [string, string] }[] =
  [
    {
      key: 'with_government_pct',
      label: ['Voted with the government', 'Röstade som regeringen'],
    },
    {
      key: 'on_winning_side_pct',
      label: ['On the winning side', 'På den vinnande sidan'],
    },
    { key: 'cohesion_pct', label: ['Party unity', 'Partiets enighet'] },
    { key: 'attendance_pct', label: ['Attendance', 'Närvaro'] },
  ]

function OverTime({
  view,
  elections,
  sessions,
  polls,
}: {
  view: string
  elections: Elections
  sessions: Sessions
  polls: { survey_month: string; party: string; share_pct: number }[]
}) {
  const electionSlots = usePartySlots(['S', 'M', 'SD', 'V', 'C'])
  const recordSlots = usePartySlots(['S', 'M', 'SD', 'C', 'L'])
  const [measure, setMeasure] = useState<keyof SessionRecord>(
    'with_government_pct',
  )
  const sessionList = sessions.sessions.map((s) => s.session)
  const [pairSession, setPairSession] = useState(sessionList.at(-1)!)

  const electionSeries: Series[] = electionSlots.picked.map((party) => ({
    key: party,
    name: `${partyLabel(party)} (${l('election', 'val')})`,
    points: elections.results
      .filter((r) => r.party === party && r.share_pct != null)
      .map((r) => ({
        date: `${r.election_year}-09-15`,
        label: `Val ${r.election_year}`,
        value: r.share_pct!,
      })),
  }))
  const pollSeries: Series[] = electionSlots.picked.map((party) => ({
    key: party,
    name: `${partyLabel(party)} (PSU)`,
    points: polls
      .filter((p) => p.party === party && p.survey_month >= '1994-01-01')
      .map((p) => ({
        date: p.survey_month,
        label: month(p.survey_month),
        value: p.share_pct,
      })),
  }))
  const recordSeries: Series[] = recordSlots.picked.map((party) => ({
    key: party,
    name: partyLabel(party),
    points: sessions.party_record
      .filter((r) => r.party === party && r[measure] != null)
      .map((r) => ({
        date: sessionDate(r.session),
        label: `${r.session} · ${r.role === 'government' ? 'regering' : r.role === 'agreement' ? 'avtal' : 'opposition'}`,
        value: Number(r[measure]),
      })),
  }))
  const pairParties = PARTY_ORDER.filter((p) =>
    sessions.party_pairs.some(
      (pair) =>
        pair.session === pairSession &&
        (pair.party_a === p || pair.party_b === p),
    ),
  )
  const agreement = (a: string, b: string) =>
    sessions.party_pairs.find(
      (pair) =>
        pair.session === pairSession &&
        ((pair.party_a === a && pair.party_b === b) ||
          (pair.party_a === b && pair.party_b === a)),
    )?.agreement_pct
  const session = sessions.sessions.find((s) => s.session === pairSession)

  return (
    <>
      {view === '#now-history' && (
        <section
          className="report welfare-section"
          aria-labelledby="politics-elections"
        >
          <p className="eyebrow">
            {l('Elections and polls', 'Val och opinion')}
          </p>
          <h2 id="politics-elections">
            {l(
              'Support for the parties since 1973',
              'Partiernas stöd sedan 1973',
            )}
          </h2>
          <PartyPicker
            parties={PARTY_ORDER.filter((p) => p !== 'NYD')}
            {...electionSlots}
          />
          <MultiLineChart
            series={electionSeries}
            label={l('Election results by party', 'Valresultat per parti')}
            format={(v) => percent(v, 1)}
            colorOf={electionSlots.colorOf}
          />
          <h3 className="analysis-subhead">
            {l(
              'Between elections: SCB’s party preference survey',
              'Mellan valen: SCB:s partisympatiundersökning (PSU)',
            )}
          </h3>
          <MultiLineChart
            series={pollSeries}
            label={l('PSU by party', 'PSU per parti')}
            format={(v) => percent(v, 1)}
            colorOf={electionSlots.colorOf}
          />
          <p className="welfare-note">
            {l(
              'Elections: SCB 1973–2022, Valmyndigheten for 2026. PSU is a sample survey every May and November; SCB’s margins of error are around ±1 point for the largest parties. Ny demokrati (1991–1994) is not shown: SCB publishes its seats but counts its votes among other parties.',
              'Val: SCB 1973–2022, Valmyndigheten för 2026. PSU är en urvalsundersökning varje maj och november; SCB:s felmarginal är omkring ±1 procentenhet för de största partierna. Ny demokrati (1991–1994) visas inte: SCB redovisar partiets mandat men räknar dess röster bland övriga partier.',
            )}
          </p>
        </section>
      )}

      {view === '#now-votes' && (
        <section
          className="report welfare-section"
          aria-labelledby="politics-record"
        >
          <p className="eyebrow">
            {l('The Riksdag since 1993', 'Riksdagen sedan 1993')}
          </p>
          <h2 id="politics-record">
            {l(
              'How the parties have voted, session by session',
              'Hur partierna har röstat, riksmöte för riksmöte',
            )}
          </h2>
          <div className="slicers">
            <label className="wide">
              {l('Measure', 'Mått')}
              <select
                value={measure}
                onChange={(e) =>
                  setMeasure(e.target.value as keyof SessionRecord)
                }
              >
                {RECORD_MEASURES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {l(...m.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PartyPicker
            parties={PARTY_ORDER.filter((p) => p !== 'OTHER')}
            {...recordSlots}
          />
          <MultiLineChart
            series={recordSeries}
            label={l(...RECORD_MEASURES.find((m) => m.key === measure)!.label)}
            format={(v) => percent(v, 0)}
            colorOf={recordSlots.colorOf}
          />
          <p className="welfare-note">
            {l(
              'Every roll call on a decision since 1993/94 (22,000+), from the Riksdag’s own files. A party’s position is what most of its present members voted. “Voted with the government” compares it with the prime minister’s party. The tooltip says whether the party was in government, in a written agreement with it, or in opposition.',
              'Varje votering om ett beslut sedan 1993/94 (över 22 000), ur riksdagens egna filer. Ett partis ståndpunkt är vad flest av dess närvarande ledamöter röstade. ”Röstade som regeringen” jämför med statsministerns parti. Verktygstipset visar om partiet satt i regeringen, hade ett skriftligt avtal med den eller var i opposition.',
            )}
          </p>

          <h3 className="analysis-subhead">
            {l('Which parties vote alike?', 'Vilka partier röstar lika?')}
          </h3>
          <div className="slicers">
            <label>
              {l('Session', 'Riksmöte')}
              <select
                value={pairSession}
                onChange={(e) => setPairSession(e.target.value)}
              >
                {sessionList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {session && (
              <p className="welfare-note pair-context">
                {session.government_name} (
                {session.government_parties.join(', ')}) · {session.roll_calls}{' '}
                {l('roll calls', 'voteringar')}
              </p>
            )}
          </div>
          <div className="table-scroll">
            <table
              className="welfare-table compact agreement-matrix"
              data-testid="agreement-matrix"
            >
              <caption>
                {l(
                  'Share of decisions on which two parties took the same position',
                  'Andel beslut där två partier tog samma ståndpunkt',
                )}
              </caption>
              <thead>
                <tr>
                  <th />
                  {pairParties.map((p) => (
                    <th key={p} scope="col">
                      {partyLabel(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pairParties.map((a) => (
                  <tr key={a}>
                    <th scope="row">{partyLabel(a)}</th>
                    {pairParties.map((b) => {
                      const value = a === b ? null : agreement(a, b)
                      return (
                        <td
                          key={b}
                          style={
                            value != null
                              ? {
                                  background: `rgba(0, 143, 130, ${(value / 100) ** 2 * 0.55})`,
                                }
                              : undefined
                          }
                        >
                          {value != null ? Math.round(value) : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default function NowPage({ view }: { view: string }) {
  const [now, setNow] = useState<Now | null>(null)
  const [elections, setElections] = useState<Elections | null>(null)
  const [sessions, setSessions] = useState<Sessions | null>(null)
  const [polls, setPolls] = useState<
    { survey_month: string; party: string; share_pct: number }[]
  >([])
  const [issues, setIssues] = useState<Issues | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      load<Now>('parliament/now.json'),
      load<Elections>('parliament/elections.json'),
      load<Sessions>('parliament/sessions.json'),
      load<{
        polls: { survey_month: string; party: string; share_pct: number }[]
      }>('parliament/polls.json'),
      load<Issues>('parliament/issues.json'),
    ])
      .then(([n, e, s, p, i]) => {
        setNow(n)
        setElections(e)
        setSessions(s)
        setPolls(p.polls)
        setIssues(i)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const lines = useMemo(() => (now ? summary(now) : []), [now])
  return (
    <div className="project-page welfare-page politics-now">
      <div className="page-lead">
        <p className="eyebrow">{l('Swedish politics', 'Svensk politik')}</p>
        <h1>{l('Politics right now', 'Politiken just nu')}</h1>
        <p>
          {l(
            'The election, the government, the polls and what the Riksdag decides, in one place and from the official sources: Valmyndigheten, SCB, the Riksdag and the Government Offices. Updated from the sources; everything links back to them.',
            'Valet, regeringen, opinionen och vad riksdagen beslutar, samlat på ett ställe och från de officiella källorna: Valmyndigheten, SCB, riksdagen och Regeringskansliet. Uppdateras från källorna; allt länkar tillbaka till dem.',
          )}
        </p>
        <TopicNav
          active={view === '#now' ? '#now-election' : view}
          items={[
            ['#now-election', 'Election result', 'Valresultat'],
            ['#now-government', 'Government', 'Regeringen'],
            ['#now-decisions', 'Decisions', 'Beslut'],
            ['#now-history', 'Opinion over time', 'Opinion över tid'],
            ['#now-votes', 'Voting history', 'Rösthistorik'],
            ['#now-issues', 'Issues', 'Sakfrågor'],
            ['#now-laws', 'Laws', 'Lagar'],
            ['#now-studies', 'Studies', 'Utredningar'],
            ['#now-depth', 'Sources & details', 'Källor & fördjupning'],
          ]}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {!now && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}

      {now && ['#now', '#now-election'].includes(view) && (
        <section
          className="report welfare-section now-summary"
          aria-label={l('Summary', 'Sammanfattning')}
        >
          <p className="eyebrow">{l('In short', 'I korthet')}</p>
          <ul className="plain-summary" data-testid="plain-summary">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {now && ['#now', '#now-election'].includes(view) && (
        <section
          className="report welfare-section"
          aria-labelledby="now-election-heading"
          id="now-election"
        >
          <p className="eyebrow">
            {l('Riksdag election', 'Riksdagsvalet')} {now.election.year} ·{' '}
            {now.election.count_status === 'slutlig'
              ? l('final result', 'slutligt resultat')
              : l('preliminary result', 'preliminärt resultat')}
          </p>
          <h2 id="now-election-heading">
            {l('The new Riksdag: 349 seats', 'Den nya riksdagen: 349 mandat')}
          </h2>
          <SeatBar
            parties={now.election.parties}
            majority={now.election.majority}
          />
          <div className="table-scroll">
            <table className="welfare-table compact">
              <thead>
                <tr>
                  <th>{l('Party', 'Parti')}</th>
                  <th>{l('Share', 'Andel')}</th>
                  <th>{l('Change', 'Förändring')}</th>
                  <th>{l('Seats', 'Mandat')}</th>
                  <th>
                    {l('Poll', 'PSU')} {month(now.poll.survey_month)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {now.election.parties.map((p) => {
                  const poll = now.poll.parties.find((q) => q.party === p.party)
                  return (
                    <tr key={p.party}>
                      <td>{PARTY_NAMES[p.party] ?? p.name}</td>
                      <td>{percent(p.share_pct, 2)}</td>
                      <td>
                        {p.previous_share_pct != null && p.share_pct != null
                          ? `${signed(p.share_pct - p.previous_share_pct)} p.e.`
                          : '–'}
                      </td>
                      <td>
                        {p.seats}
                        {p.previous_seats != null &&
                          p.seats !== p.previous_seats && (
                            <small>
                              {' '}
                              ({signed(p.seats - p.previous_seats, 0)})
                            </small>
                          )}
                      </td>
                      <td>
                        {poll ? percent(poll.share_pct, 1) : '–'}
                        {poll?.margin_of_error_pp != null && (
                          <small>
                            {' '}
                            ±{poll.margin_of_error_pp.toLocaleString('sv-SE')}
                          </small>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="welfare-note">
            {l(
              `Result from ${now.election.source}; change against the previous election. The poll is SCB’s last survey before the election.`,
              `Resultat från ${now.election.source}; förändring mot förra valet. PSU är SCB:s senaste mätning före valet.`,
            )}
          </p>
        </section>
      )}

      {now && view === '#now-government' && (
        <section
          className="report welfare-section"
          aria-labelledby="now-government-heading"
          id="now-government"
        >
          <p className="eyebrow">{l('Government', 'Regeringen')}</p>
          <h2 id="now-government-heading">{now.government.government_name}</h2>
          <dl className="government-facts">
            <div>
              <dt>{l('Prime minister', 'Statsminister')}</dt>
              <dd>
                {now.government.prime_minister} (
                {now.government.prime_minister_party})
              </dd>
            </div>
            <div>
              <dt>{l('Parties', 'Partier')}</dt>
              <dd>{now.government.government_parties.join(', ')}</dd>
            </div>
            {now.government.agreement_name && (
              <div>
                <dt>{l('Agreement', 'Avtal')}</dt>
                <dd>
                  {now.government.agreement_name} (
                  {now.government.agreement_parties?.join(', ')})
                </dd>
              </div>
            )}
            <div>
              <dt>{l('Since', 'Sedan')}</dt>
              <dd>{day(now.government.start_date)}</dd>
            </div>
          </dl>
          {now.government.status_note && (
            <p className="status-note">
              {now.government.status_note}.{' '}
              <a
                href={now.government.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {l('Source ↗', 'Källa ↗')}
              </a>
            </p>
          )}
          {now.formation_news.length > 0 && (
            <>
              <h3 className="analysis-subhead">
                {l(
                  'Forming a government: the Riksdag’s own news',
                  'Regeringsbildningen: riksdagens egna nyheter',
                )}
              </h3>
              <ol className="formation-timeline">
                {now.formation_news.map((item) => (
                  <li key={item.date + item.title}>
                    <time dateTime={item.date.slice(0, 10)}>
                      {day(item.date)}
                    </time>
                    <strong>{item.title}</strong>
                    {item.summary && <p>{item.summary}</p>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {now && view === '#now-decisions' && (
        <section
          className="report welfare-section"
          aria-labelledby="now-decisions-heading"
          id="now-decisions"
        >
          <p className="eyebrow">
            {l('The Riksdag', 'Riksdagen')} · {now.latest_session}
          </p>
          <h2 id="now-decisions-heading">
            {l(
              'The latest decisions, and how each party voted',
              'De senaste besluten, och hur varje parti röstade',
            )}
          </h2>
          <DecisionList decisions={now.latest_decisions} />
        </section>
      )}

      {['#now-history', '#now-votes'].includes(view) &&
        elections &&
        sessions && (
          <OverTime
            view={view}
            elections={elections}
            sessions={sessions}
            polls={polls}
          />
        )}

      {view === '#now-issues' && issues && (
        <section
          className="report welfare-section"
          aria-labelledby="now-issues-heading"
          id="now-issues"
        >
          <p className="eyebrow">{l('Issues', 'Sakfrågor')}</p>
          <h2 id="now-issues-heading">
            {l(
              'Each issue: what was decided, who voted how, what it costs, how it is going',
              'Varje sakfråga: vad som beslutats, hur partierna röstat, vad det kostar, hur det går',
            )}
          </h2>
          <div className="issue-grid">
            {issues.issues.map((issue) => {
              const last = issue.per_session.at(-1)
              return (
                <a
                  key={issue.issue_key}
                  className="issue-card"
                  href={`#issue-${issue.issue_key}`}
                >
                  <strong>{issue.issue_name_sv}</strong>
                  <span>{issue.summary_sv}</span>
                  {last && (
                    <small>
                      {last.decisions} {l('decisions in', 'beslut')}{' '}
                      {last.session}
                    </small>
                  )}
                </a>
              )
            })}
          </div>
        </section>
      )}

      {view === '#now-studies' && <StudiesView />}

      {view === '#now-laws' && (
        <section className="report welfare-section" id="now-laws">
          <details className="inline-law-library" open>
            <summary>
              {l('Read laws on this page', 'Läs lagarna direkt på sidan')}
            </summary>
            <LawLibrary />
          </details>
        </section>
      )}
      {view === '#now-depth' && (
        <section className="report welfare-section" aria-labelledby="now-depth">
          <p className="eyebrow">{l('In depth', 'Fördjupning')}</p>
          <h2 id="now-depth">{l('The full records', 'Hela underlaget')}</h2>
          <ul className="depth-links">
            <li>
              <a href="#politics">
                {l(
                  'From words to decisions: debates, votes and laws',
                  'Från ord till beslut: debatter, voteringar och lagar',
                )}
              </a>
            </li>
            <li>
              <a href="#politics-votes">
                {l(
                  'Every member’s vote, recent sessions',
                  'Varje ledamots röst, senaste riksmötena',
                )}
              </a>
            </li>
            <li>
              <a href="#budget-comparison">
                {l(
                  'The budget: government and party proposals',
                  'Budgeten: regeringens och partiernas förslag',
                )}
              </a>
            </li>
            <li>
              <a href="#budget-outturn">
                {l(
                  'What was budgeted, and what was spent',
                  'Vad som budgeterades, och vad som användes',
                )}
              </a>
            </li>
            <li>
              <a href="#debates">
                {l(
                  'Search 250,000 speeches since 1993',
                  'Sök bland 250 000 tal sedan 1993',
                )}
              </a>
            </li>
            <li>
              <a href="#taxes">
                {l(
                  'Taxes: what Sweden collects, and a calculator for yours',
                  'Skatter: vad Sverige tar in, och en räknare för din skatt',
                )}
              </a>
            </li>
            <li>
              <a href="#sweden">
                {l(
                  'How Sweden is doing: welfare data',
                  'Hur mår Sverige: välfärdsdata',
                )}
              </a>
            </li>
          </ul>
        </section>
      )}
    </div>
  )
}
