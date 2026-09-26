import { t } from '../i18n'
import { useEffect, useState } from 'react'
import {
  PARTIES,
  GOLD_ROOT,
  ROOT,
  count,
  useDataUrl,
  useGoldData,
  type Decision,
  type Overview,
} from './data'
import VoteCharts from './VoteCharts'
import CommitteeComparison from './CommitteeComparison'
import { committeeLabel } from './committees'
import DecisionExplorer from './DecisionExplorer'
import LawLibrary from './LawLibrary'
import DebateArchive from './DebateArchive'
import MemberVoteExplorer from './MemberVoteExplorer'
import './politics.css'

function SessionAnalysis({ path }: { path: string }) {
  const { data, error } = useGoldData<Decision[]>(path)
  const [committee, setCommittee] = useState('All')
  const [party, setParty] = useState('M')
  const committees = [...new Set(data?.map((d) => d.committee) ?? [])].sort(
    (a, b) => committeeLabel(a).localeCompare(committeeLabel(b), 'sv'),
  )
  const decisions =
    data?.filter((d) => committee === 'All' || d.committee === committee) ?? []
  if (error) return <p role="alert">{error}</p>
  if (!data) return <p>{t('Loading recorded votes…')}</p>
  return (
    <>
      <div className="politics-controls">
        <label>
          {t('Committee\n          ')}
          <select
            value={committee}
            onChange={(e) => setCommittee(e.target.value)}
          >
            <option value="All">{t('All committees')}</option>
            {committees.map((c) => (
              <option key={c} value={c}>
                {committeeLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Party for decision detail\n          ')}
          <select value={party} onChange={(e) => setParty(e.target.value)}>
            {PARTIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <p>
          {count(decisions.length)}{' '}
          {t('roll calls in this view · all eight parties\n        ')}
        </p>
      </div>
      {committee !== 'All' && (
        <CommitteeComparison
          selected={decisions}
          all={data}
          committee={committee}
          onParty={setParty}
        />
      )}
      <VoteCharts decisions={decisions} onParty={setParty} />
      <DecisionExplorer decisions={decisions} party={party} />
    </>
  )
}

export default function PoliticsLab() {
  const { data, error } = useGoldData<Overview>('overview.json')
  const semanticModelUrl = useDataUrl(GOLD_ROOT + 'semantic-model.json')
  const catalogUrl = useDataUrl(ROOT + 'catalog.json')
  const manifestUrl = useDataUrl(ROOT + 'parliament/manifest.json')
  const lawIndexUrl = useDataUrl(ROOT + 'laws/index.json')
  const [session, setSession] = useState('2025/26')
  const [tab, setTab] = useState('votes')
  useEffect(() => {
    const navigate = () => {
      if (window.location.hash === '#politics-votes') setTab('votes')
      if (window.location.hash === '#politics-laws') setTab('meaning')
    }
    navigate()
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  const active = data?.sessions.find((s) => s.id === session)
  return (
    <article className="politics-lab report" id="politics">
      <span id="politics-votes" />
      <span id="politics-laws" />
      <p className="eyebrow">
        {t('Political observatory · Swedish Parliament')}
      </p>
      <h2>{t('From political words to recorded decisions.')}</h2>
      <p className="politics-intro">
        {t(
          'Speeches, budget proposals and formal decisions are spread across\n        different documents. This observatory brings the imported records\n        together so you can follow the evidence and make your own comparisons.\n      ',
        )}
      </p>
      <div className="politics-purpose">
        <strong>{t('Why I built this')}</strong>
        <p>
          {t(
            'I find it difficult to connect political language with budget priorities and what is actually decided. This is my attempt to make that formal record easier to navigate: start with a question, inspect the data, then open the original source.',
          )}
        </p>
      </div>
      <div
        className="politics-journey"
        aria-label={t('Explore political records')}
      >
        <a href="#politics" onClick={() => setTab('debates')}>
          <strong>{t('01 · What was said')}</strong>
          <span>{t('Full speeches, replies and searchable transcripts')}</span>
        </a>
        <a href="#budget-comparison">
          <strong>{t('02 · What was proposed')}</strong>
          <span>{t('Budget frames and language comparisons')}</span>
        </a>
        <a href="#politics" onClick={() => setTab('votes')}>
          <strong>{t('03 · How they voted')}</strong>
          <span>{t('Party votes, exact proposals and cited documents')}</span>
        </a>
        <a href="#data-explorer">
          <strong>{t('04 · Explore the people and speeches')}</strong>
          <span>
            {t('Find a politician, read their words and follow the discussion')}
          </span>
        </a>
      </div>
      <nav className="politics-tabs" aria-label={t('Political analysis views')}>
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
      {!data && !error && <p>{t('Loading political observatory…')}</p>}
      {data && (
        <>
          <div className="politics-kpis">
            <div>
              <strong>{count(data.parliament.imported_speeches)}</strong>
              <span>{t('party-leader debate speeches')}</span>
            </div>
            <div>
              <strong>{count(data.parliament.issue_speeches)}</strong>
              <span>{t('separately indexed issue speeches')}</span>
            </div>
            <div>
              <strong>
                {count(data.sessions.reduce((n, s) => n + s.votes, 0))}
              </strong>
              <span>{t('imported roll calls · 2024/25–2025/26')}</span>
            </div>
            <div>
              <strong>{count(data.law_pools.v2.provisions)}</strong>
              <span>{t('v2 statute provisions · snapshot corpus')}</span>
            </div>
          </div>
          {tab === 'votes' && (
            <>
              <div className="politics-controls">
                <label>
                  {t('Voting session\n                  ')}
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
                {t(
                  'Roll calls cover two imported sessions. Decisions without a roll\n                call and unimported years are not counted as abstentions. Votes\n                refer to committee points, not automatically to each law or\n                motion cited in them.\n              ',
                )}
              </p>
              {active && (
                <SessionAnalysis key={active.path} path={active.path} />
              )}
              {active && (
                <MemberVoteExplorer
                  key={'mv' + active.path}
                  sessionPath={active.path}
                />
              )}
            </>
          )}
          {tab === 'debates' && <DebateArchive />}
          {tab === 'meaning' && <LawLibrary />}
          {tab === 'data' && (
            <section className="politics-card">
              <h3>{t('One source trail, explicit evidence levels.')}</h3>
              <p>
                {t(
                  'The charts read a versioned gold model with keyed facts,\n                dimensions and documented measures. Original parliamentary\n                exports remain available for audit; decision details and law\n                provisions load separately when selected. The source catalog\n                records file sizes and SHA-256 checksums.\n              ',
                )}
              </p>
              <div className="data-downloads">
                <a href={semanticModelUrl} download>
                  {t('Download gold semantic model\n                ')}
                </a>
                <a href={catalogUrl} download>
                  {t('Download complete data catalog\n                ')}
                </a>
                <a href={manifestUrl} download>
                  {t('Parliament export manifest\n                ')}
                </a>
                <a href={lawIndexUrl} download>
                  {t('Law snapshot index\n                ')}
                </a>
              </div>
              <h4>{t('Measures that are useful now')}</h4>
              <ul>
                <li>
                  {t(
                    'Party agreement with paired denominators and exact vote distributions.\n                ',
                  )}
                </li>
                <li>
                  {t(
                    'Exact vote distributions, proposal citations and reservations\n                  by committee and session.\n                ',
                  )}
                </li>
                <li>
                  {t(
                    'Debate volume and topic shares; semantic links as discovery\n                  candidates.\n                ',
                  )}
                </li>
                <li>
                  {t(
                    'Source coverage, snapshot versions and readiness of reviewed\n                  legal comparisons.\n                ',
                  )}
                </li>
              </ul>
              <h4>{t('Measures that need more evidence')}</h4>
              <p>
                {t(
                  "A party's tightening/loosening profile needs a reviewed link to\n                an exact before/after legal provision, the governed actor,\n                version dates and annotated slots. Vote-to-direction joins and\n                independent annotation agreement remain missing. We do not\n                convert semantic similarity or lexical counts into a political\n                honesty score.\n              ",
                )}
              </p>
              <p>
                {t('Snapshot pool v1: ')}
                {count(data.law_pools.v1.provisions)} {t('provisions in ')}
                {count(data.law_pools.v1.documents)}{' '}
                {t('parsed\n                documents. v2: ')}
                {count(data.law_pools.v2.provisions)}{' '}
                {t('provisions\n                in ')}
                {count(data.law_pools.v2.documents)}{' '}
                {t(
                  'parsed documents. The\n                broader v2 source pool contains unparsed documents; these counts\n                describe parsed provision snapshots.\n              ',
                )}
              </p>
              <p>
                {t(
                  'Independent project using Swedish Parliament public data. Not\n                affiliated with Parliament. Original source text is retained in\n                Swedish.\n              ',
                )}
              </p>
              <a
                href="https://github.com/korv9/partiledardebatt-analys"
                target="_blank"
                rel="noreferrer"
              >
                {t('Debate project ↗\n              ')}
              </a>{' '}
              ·{' '}
              <a
                href="https://github.com/korv9/allegoria"
                target="_blank"
                rel="noreferrer"
              >
                {t('Allegoria & meaningquality ↗\n              ')}
              </a>
            </section>
          )}
        </>
      )}
    </article>
  )
}
