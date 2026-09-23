import { useState } from 'react'
import { PARTIES, count, useData } from './data'

type Envelope<T> = { data: T }
type Debate = {
  protocol_id?: string
  section_id?: string
  session?: string
  debate_date?: string
  debate_title: string
  speech_count: number
  reply_count: number
  path: string
  first_speech_number?: number
  last_speech_number?: number
}
type IssueSession = {
  session: string
  speech_count: number
  index_path: string
}
type Speech = {
  speech_id: string
  speaker: string
  party: string
  speech_date: string
  speech_number: number
  speech_text: string
  is_reply: boolean
  source_url: string
}

function Transcript({ debate }: { debate: Debate }) {
  const { data, error } = useData<Envelope<Speech[]>>(
    'parliament/' + debate.path,
  )
  const [party, setParty] = useState('All')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(15)
  const speeches = (data?.data ?? []).filter(
    (s) =>
      debate.first_speech_number == null ||
      (s.speech_number >= debate.first_speech_number &&
        s.speech_number <= (debate.last_speech_number ?? Infinity)),
  )
  const matches = speeches.filter(
    (s) =>
      (party === 'All' || s.party === party) &&
      `${s.speaker} ${s.speech_text}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const counts = [
    ...new Set([...PARTIES, ...speeches.map((s) => s.party)]),
  ].map((p) => ({
    party: p,
    speeches: speeches.filter((s) => s.party === p).length,
    replies: speeches.filter((s) => s.party === p && s.is_reply).length,
  }))
  const max = Math.max(1, ...counts.map((c) => c.speeches))
  return (
    <div className="archive-transcript">
      <h4>{debate.debate_title}</h4>
      <p>
        {debate.debate_date} · {speeches.length} imported speeches. Reply flags
        describe the source classification, not who is replying to whom.
      </p>
      {error && <p role="alert">{error}</p>}
      <div
        className="archive-bars"
        aria-label="Speech and reply counts per party"
      >
        {counts.map((c) => (
          <div key={c.party}>
            <b>{c.party}</b>
            <span className="metric-track">
              <i style={{ width: `${(c.speeches / max) * 100}%` }} />
            </span>
            <span>
              {c.speeches} speeches · {c.replies} replies
            </span>
          </div>
        ))}
      </div>
      <div className="politics-controls">
        <label>
          Transcript party
          <select
            value={party}
            onChange={(e) => {
              setParty(e.target.value)
              setLimit(15)
            }}
          >
            <option>All</option>
            {[...new Set(speeches.map((s) => s.party))].sort().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Search this transcript
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(15)
            }}
            placeholder="Search source text or speaker"
          />
        </label>
      </div>
      <p>{matches.length} matches in this transcript.</p>
      {matches.slice(0, limit).map((s) => (
        <details className="speech-record" key={s.speech_id}>
          <summary>
            {s.speech_number}. {s.speaker} ({s.party}){' '}
            {s.is_reply ? '· reply' : ''}
          </summary>
          <p lang="sv" className="source-text">
            {s.speech_text}
          </p>
          <a href={s.source_url} target="_blank" rel="noreferrer">
            Read parliamentary source ↗
          </a>
        </details>
      ))}
      {matches.length > limit && (
        <button className="archive-more" onClick={() => setLimit(limit + 15)}>
          Show 15 more speeches
        </button>
      )}
    </div>
  )
}

export default function DebateArchive() {
  const debates = useData<Envelope<Debate[]>>('parliament/debates/index.json')
  const issues = useData<Envelope<IssueSession[]>>(
    'parliament/issues/index.json',
  )
  const [kind, setKind] = useState('leaders')
  const [session, setSession] = useState('2025/26')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [limit, setLimit] = useState(30)
  const issuePath = issues.data?.data.find(
    (s) => s.session === session,
  )?.index_path
  const issueIndex = useData<Envelope<Debate[]>>(
    kind === 'issues' && issuePath ? 'parliament/' + issuePath : null,
  )
  const sessions = [
    ...new Set(
      kind === 'leaders'
        ? debates.data?.data.map((d) => d.session ?? '')
        : issues.data?.data.map((s) => s.session),
    ),
  ]
    .sort()
    .reverse()
  const entries =
    (kind === 'leaders'
      ? debates.data?.data.filter((d) => d.session === session)
      : issueIndex.data?.data) ?? []
  const matches = entries.filter((d) =>
    d.debate_title.toLowerCase().includes(query.toLowerCase()),
  )
  const active = matches.find(
    (d) => (d.section_id || d.protocol_id) === selected,
  )
  return (
    <section className="politics-card debate-archive">
      <p className="eyebrow">Read the debate in context</p>
      <h3>Speeches, replies and the surrounding discussion.</h3>
      <p>
        Full source text from the imported metadata selection. Issue debates
        form a separate archive and are not included in the party-leader UMAP
        model. Older categorisation is incomplete; counts are coverage, not all
        political discussion.
      </p>
      <div className="politics-controls">
        <label>
          Archive
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value)
              setSelected('')
              setQuery('')
              setLimit(30)
            }}
          >
            <option value="leaders">Party-leader debates</option>
            <option value="issues">Issue debates</option>
          </select>
        </label>
        <label>
          Debate session
          <select
            value={session}
            onChange={(e) => {
              setSession(e.target.value)
              setSelected('')
              setLimit(30)
            }}
          >
            {sessions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Find a debate
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(30)
            }}
            placeholder="Search debate titles"
          />
        </label>
      </div>
      {(debates.error || issues.error || issueIndex.error) && (
        <p role="alert">{debates.error || issues.error || issueIndex.error}</p>
      )}
      <p>
        {count(matches.length)} matching{' '}
        {kind === 'leaders' ? 'protocols' : 'debate sections'}.
      </p>
      <div className="decision-layout">
        <div className="decision-list">
          {matches.slice(0, limit).map((d) => (
            <button
              key={d.section_id || d.protocol_id}
              aria-pressed={active === d}
              onClick={() => setSelected(d.section_id || d.protocol_id || '')}
            >
              <strong>{d.debate_title}</strong>
              <small>
                {d.debate_date} · {d.speech_count} speeches · {d.reply_count}{' '}
                replies
              </small>
            </button>
          ))}
          {matches.length > limit && (
            <button onClick={() => setLimit(limit + 30)}>
              Show 30 more sections
            </button>
          )}
        </div>
        {active ? (
          <Transcript key={active.section_id || active.path} debate={active} />
        ) : (
          <p>Select a debate to load its full transcript.</p>
        )}
      </div>
    </section>
  )
}
