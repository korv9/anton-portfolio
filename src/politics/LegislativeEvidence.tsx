import { useData } from './data'

type Pair = {
  pair_id: string
  source_reference: string
  source_excerpt: string
  source_url: string
  proposition_reference: string
  proposition_url: string
  provision_reference: string
  proposal_excerpt: string
  comparison_status: string
  review_note: string
}

export default function LegislativeEvidence() {
  const { data, error } = useData<{ data: Pair[] }>(
    'parliament/legislative/comparisons.json',
  )
  return (
    <section className="politics-card">
      <h4>What does the summary leave out?</h4>
      <p>
        Two source-linked examples compare a political description with proposed
        legal text. They are not verified enacted amendments or eligible
        direction measurements. The second extraction interleaves two law-text
        columns and requires layout review.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.data.map((pair) => (
        <details key={pair.pair_id}>
          <summary>
            {pair.source_reference} → {pair.provision_reference}
          </summary>
          <div className="politics-grid">
            <div>
              <h5>Political description</h5>
              <blockquote lang="sv">{pair.source_excerpt}</blockquote>
              <a href={pair.source_url} target="_blank" rel="noreferrer">
                Read source ↗
              </a>
            </div>
            <div>
              <h5>Proposed law · {pair.proposition_reference}</h5>
              <p lang="sv" className="source-text legislative-excerpt">
                {pair.proposal_excerpt}
              </p>
              <a href={pair.proposition_url} target="_blank" rel="noreferrer">
                Inspect proposal layout ↗
              </a>
            </div>
          </div>
          <p>Status: {pair.comparison_status.replaceAll('_', ' ')}</p>
          <p lang="sv">{pair.review_note}</p>
        </details>
      ))}
    </section>
  )
}
