import { useState } from 'react'
import { positionFromVotes, useData, type Decision, type PartyVote } from './data'

type Detail = {
  point: { proposal_text: string; source_url: string } | null
  parties: PartyVote[]
  members: { member_name: string; party: string; vote: string }[]
  citations: {
    document_reference: string
    document_title: string
    document_url: string
  }[]
  reservations: { party: string; heading: string; reservation_number: string }[]
  speech_links: {
    party: string
    speaker: string
    speech_excerpt: string
    speech_url: string
    cosine_similarity: number
    same_member: boolean
    speaker_vote: string | null
  }[]
}
function DecisionDetail({ decision }: { decision: Decision }) {
  const { data, error } = useData<Detail>(decision.path)
  if (error) return <p role="alert">{error}</p>
  if (!data) return <p>Loading source evidence…</p>
  return (
    <div className="decision-detail">
      <h5>{decision.heading || decision.title}</h5>
      <p>
        {decision.designation} · point {decision.point} · {decision.date}
      </p>
      {data.point ? (
        <>
          <blockquote lang="sv">{data.point.proposal_text}</blockquote>
          <a href={data.point.source_url} target="_blank" rel="noreferrer">
            Read the exact committee proposal ↗
          </a>
        </>
      ) : (
        <p>
          Exact proposal text is missing in this export. Read the source before
          interpreting the vote.
        </p>
      )}
      <div className="decision-party-grid">
        {data.parties.map((p) => (
          <div key={p.party}>
            <strong>
              {p.party} · {positionFromVotes(p)}
            </strong>
            <span>
              {p.yes_votes} yes / {p.no_votes} no / {p.abstain_votes} abstain /{' '}
              {p.absent_votes} absent
            </span>
          </div>
        ))}
      </div>
      <details>
        <summary>Named member votes ({data.members.length})</summary>
        <div className="member-votes">
          {data.members.map((m, i) => (
            <p key={i}>
              {m.member_name} ({m.party}) <strong>{m.vote}</strong>
            </p>
          ))}
        </div>
      </details>
      <details>
        <summary>Explicit document citations ({data.citations.length})</summary>
        <p>
          A citation means the proposal is considered here; it does not
          establish support.
        </p>
        {data.citations.map((c, i) => (
          <p key={i}>
            <a href={c.document_url} target="_blank" rel="noreferrer">
              {c.document_reference} · {c.document_title} ↗
            </a>
          </p>
        ))}
      </details>
      <details>
        <summary>Reservations ({data.reservations.length})</summary>
        {data.reservations.map((r, i) => (
          <p key={i}>
            {r.party} · {r.reservation_number} · {r.heading}
          </p>
        ))}
      </details>
      <details>
        <summary>
          Related earlier debate passages ({data.speech_links.length})
        </summary>
        <p>
          Semantic search candidates, not evidence of consistency or
          contradiction. Similarity ≥ 0.60; selected earlier speeches from the
          same party.
        </p>
        {data.speech_links.map((s, i) => (
          <article key={i}>
            <strong>
              {s.speaker} · {s.party} · similarity{' '}
              {s.cosine_similarity.toFixed(2)}
            </strong>
            <blockquote lang="sv">{s.speech_excerpt}</blockquote>
            <p>
              {s.same_member
                ? `Speaker's recorded vote: ${s.speaker_vote ?? 'unavailable'}`
                : 'No same-member vote established.'}
            </p>
            <a href={s.speech_url} target="_blank" rel="noreferrer">
              Read the speech ↗
            </a>
          </article>
        ))}
      </details>
      <p className="evidence-note">
        Vote → enacted law → versioned provision → reviewed slot change is not
        yet established. No tightening/loosening party score is assigned.
      </p>
    </div>
  )
}

export default function DecisionExplorer({
  decisions,
  party,
}: {
  decisions: Decision[]
  party: string
}) {
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('All')
  const [selected, setSelected] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const matches = decisions.filter(
    (d) =>
      `${d.title} ${d.heading} ${d.designation}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (position === 'All' ||
        d.parties.some(
          (p) => p.party === party && p.party_position === position,
        )),
  )
  const active = matches.find((d) => d.id === selected)
  return (
    <section className="politics-card decision-explorer">
      <p className="eyebrow">04 / Follow the evidence</p>
      <h4>What did they actually vote on?</h4>
      <div className="politics-controls">
        <label>
          Search decisions
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(20)
            }}
            placeholder="e.g. klimat, skatt, arbetsrätt"
          />
        </label>
        <label>
          {party}'s position
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="All">All positions</option>
            <option value="Ja">Yes to committee proposal</option>
            <option value="Nej">No to committee proposal</option>
            <option value="Avstår">Abstain</option>
          </select>
        </label>
      </div>
      <p>
        {matches.length} matching roll calls. Original source text stays in
        Swedish.
      </p>
      <div className="decision-layout">
        <div className="decision-list">
          {matches.slice(0, limit).map((d) => (
            <button
              key={d.id}
              aria-pressed={selected === d.id}
              onClick={() => setSelected(d.id)}
            >
              <small>
                {d.designation} · point {d.point} · {d.date}
              </small>
              <strong>{d.heading || d.title}</strong>
              <span>
                {party}:{' '}
                {d.parties.find((p) => p.party === party)?.party_position ??
                  'unavailable'}
              </span>
            </button>
          ))}
          {matches.length > limit && (
            <button onClick={() => setLimit(limit + 20)}>Show 20 more</button>
          )}
        </div>
        {active ? (
          <DecisionDetail key={active.id} decision={active} />
        ) : (
          <div className="decision-detail">
            <h5>Select a decision</h5>
            <p>
              Inspect the exact proposal, all eight parties, named votes,
              reservations, cited documents and related speeches.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
