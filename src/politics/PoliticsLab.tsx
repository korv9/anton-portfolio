import { useState } from 'react'
import {
  PARTIES,
  ROOT,
  count,
  useData,
  type Decision,
  type Overview,
} from './data'
import VoteCharts from './VoteCharts'
import DecisionExplorer from './DecisionExplorer'
import LawLibrary from './LawLibrary'
import DebateArchive from './DebateArchive'
import './politics.css'

function SessionAnalysis({ path }: { path: string }) {
  const { data, error } = useData<Decision[]>(path)
  const [committee, setCommittee] = useState('All')
  const [party, setParty] = useState('M')
  const committees = [...new Set(data?.map((d) => d.committee) ?? [])].sort()
  const decisions =
    data?.filter((d) => committee === 'All' || d.committee === committee) ?? []
  if (error) return <p role="alert">{error}</p>
  if (!data) return <p>Loading recorded votes…</p>
  return (
    <>
      <div className="politics-controls">
        <label>
          Committee
          <select
            value={committee}
            onChange={(e) => setCommittee(e.target.value)}
          >
            <option value="All">All committees</option>
            {committees.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Party for decision detail
          <select value={party} onChange={(e) => setParty(e.target.value)}>
            {PARTIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <p>
          {count(decisions.length)} roll calls in this view · all eight parties
        </p>
      </div>
      <VoteCharts decisions={decisions} onParty={setParty} />
      <DecisionExplorer decisions={decisions} party={party} />
    </>
  )
}

export default function PoliticsLab() {
  const { data, error } = useData<Overview>('overview.json')
  const [session, setSession] = useState('2025/26')
  const [tab, setTab] = useState('votes')
  const active = data?.sessions.find((s) => s.id === session)
  return (
    <article className="politics-lab report" id="politics">
      <p className="eyebrow">Political observatory · Swedish Parliament</p>
      <h2>From political words to recorded decisions.</h2>
      <p className="politics-intro">
        Explore what was said, what Parliament voted on, and what the legal text
        actually contains. A source-led research notebook on Swedish politics,
        with room to inspect the evidence behind every interpretation.
      </p>
      <nav className="politics-tabs" aria-label="Political analysis views">
        {[
          ['votes', 'Votes & decisions'],
          ['debates', 'Speech archive'],
          ['meaning', 'Law & sources'],
          ['data', 'Data & methods'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading political observatory…</p>}
      {data && (
        <>
          <div className="politics-kpis">
            <div>
              <strong>{count(data.parliament.imported_speeches)}</strong>
              <span>party-leader debate speeches</span>
            </div>
            <div>
              <strong>{count(data.parliament.issue_speeches)}</strong>
              <span>separately indexed issue speeches</span>
            </div>
            <div>
              <strong>
                {count(data.sessions.reduce((n, s) => n + s.votes, 0))}
              </strong>
              <span>imported roll calls · 2024/25–2025/26</span>
            </div>
            <div>
              <strong>{count(data.law_pools.v2.provisions)}</strong>
              <span>v2 statute provisions · snapshot corpus</span>
            </div>
          </div>
          {tab === 'votes' && (
            <>
              <div className="politics-controls">
                <label>
                  Voting session
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                  >
                    {data.sessions.map((s) => (
                      <option key={s.id}>{s.id}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="evidence-note">
                Roll calls cover two imported sessions. Decisions without a roll
                call and unimported years are not counted as abstentions. Votes
                refer to committee points, not automatically to each law or
                motion cited in them.
              </p>
              {active && (
                <SessionAnalysis key={active.path} path={active.path} />
              )}
            </>
          )}
          {tab === 'debates' && <DebateArchive />}
          {tab === 'meaning' && <LawLibrary />}
          {tab === 'data' && (
            <section className="politics-card">
              <h3>One data collection, explicit evidence levels.</h3>
              <p>
                Every upstream frontend export is preserved under the Parliament
                snapshot. Decisions and law provisions have small, separately
                loaded files. The catalog lists their sizes and SHA-256
                checksums.
              </p>
              <div className="data-downloads">
                <a href={ROOT + 'catalog.json'} download>
                  Download complete data catalog
                </a>
                <a href={ROOT + 'parliament/manifest.json'} download>
                  Parliament export manifest
                </a>
                <a href={ROOT + 'laws/index.json'} download>
                  Law snapshot index
                </a>
              </div>
              <h4>Measures that are useful now</h4>
              <ul>
                <li>
                  Party agreement with paired denominators, internal vote
                  cohesion and recorded attendance.
                </li>
                <li>
                  Exact vote distributions, proposal citations and reservations
                  by committee and session.
                </li>
                <li>
                  Debate volume and topic shares; semantic links as discovery
                  candidates.
                </li>
                <li>
                  Source coverage, snapshot versions and readiness of reviewed
                  legal comparisons.
                </li>
              </ul>
              <h4>Measures that need more evidence</h4>
              <p>
                A party's tightening/loosening profile needs a reviewed link to
                an exact before/after legal provision, the governed actor,
                version dates and annotated slots. Vote-to-direction joins and
                independent annotation agreement remain missing. We do not
                convert semantic similarity or lexical counts into a political
                honesty score.
              </p>
              <p>
                Snapshot pool v1: {count(data.law_pools.v1.provisions)}{' '}
                provisions in {count(data.law_pools.v1.documents)} parsed
                documents. v2: {count(data.law_pools.v2.provisions)} provisions
                in {count(data.law_pools.v2.documents)} parsed documents. The
                broader v2 source pool contains unparsed documents; these counts
                describe parsed provision snapshots.
              </p>
              <p>
                Independent project using Swedish Parliament public data. Not
                affiliated with Parliament. Original source text is retained in
                Swedish.
              </p>
              <a
                href="https://github.com/korv9/partiledardebatt-analys"
                target="_blank"
                rel="noreferrer"
              >
                Debate project ↗
              </a>{' '}
              ·{' '}
              <a
                href="https://github.com/korv9/allegoria"
                target="_blank"
                rel="noreferrer"
              >
                Allegoria & meaningquality ↗
              </a>
            </section>
          )}
        </>
      )}
    </article>
  )
}
