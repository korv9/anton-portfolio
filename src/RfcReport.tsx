import { useEffect, useState } from 'react'

type Version = {
  rfc: number
  requirements: number
  counts: Record<string, number>
  shares_pct: Record<string, number>
  url: string
  sha256: string
}
type Report = {
  versions: Version[]
  matched_changes: unknown[]
  scenarios: { before: string; after: string; direction: string }[]
}
export default function RfcReport() {
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState(false)
  const [scenario, setScenario] = useState(0)
  useEffect(() => {
    fetch('/data/gold/marts/rfc-drift.json')
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [])
  return (
    <article className="report rfc-report" id="rfc-drift">
      <p className="eyebrow">Allegoria · a small experiment in RFC drift</p>
      <h2>When MUST becomes SHOULD.</h2>
      <p>
        Can a small change in wording weaken a technical requirement?
        Allegoria's meaningquality engine makes that change explicit. Here, a
        cookie-specification comparison and a controlled example show what it
        can—and cannot—measure.
      </p>
      {error && <p role="alert">The RFC export could not be loaded.</p>}
      {data && (
        <>
          <div className="politics-grid">
            <section className="politics-card">
              <h3>01 / The language profile changed</h3>
              <p>
                RFC 2965 (2000) → RFC 6265 (2011). Share of statements extracted
                by the heuristic reader, grouped by their first requirement
                keyword.
              </p>
              {data.versions.map((v) => (
                <div className="rfc-version" key={v.rfc}>
                  <h4>
                    RFC {v.rfc}{' '}
                    <small>{v.requirements} extracted statements</small>
                  </h4>
                  {[
                    ['binding', 'MUST / binding'],
                    ['weak', 'SHOULD / recommended'],
                    ['absent', 'MAY / optional'],
                  ].map(([key, label]) => (
                    <div className="rfc-bar" key={key}>
                      <span>{label}</span>
                      <span className="metric-track">
                        <i style={{ width: `${v.shares_pct[key]}%` }} />
                      </span>
                      <strong>
                        {v.shares_pct[key]}% <small>({v.counts[key]})</small>
                      </strong>
                    </div>
                  ))}
                </div>
              ))}
              <p className="evidence-note">
                A different document-wide profile is not proof that the protocol
                became looser. These documents differ in content, scope and
                wording.
              </p>
            </section>
            <section className="politics-card">
              <h3>02 / A change the engine can explain</h3>
              <p>
                Synthetic example · the actor and action stay identical. Only
                obligation strength changes.
              </p>
              <label>
                Requirement change
                <select
                  value={scenario}
                  onChange={(e) => setScenario(Number(e.target.value))}
                >
                  <option value="0">MUST → SHOULD</option>
                  <option value="1">SHOULD → MUST</option>
                  <option value="2">MUST → MUST</option>
                </select>
              </label>
              <div className="rfc-example">
                <p>
                  Before: The client{' '}
                  <strong>{scenario === 1 ? 'SHOULD' : 'MUST'}</strong> validate
                  the response.
                </p>
                <p>
                  After: The client{' '}
                  <strong>{scenario === 0 ? 'SHOULD' : 'MUST'}</strong> validate
                  the response.
                </p>
              </div>
              <div className="engine-result">
                <span>Actual meaningquality output</span>
                <strong>{data.scenarios[scenario].direction}</strong>
              </div>
              <p>
                The result is computed offline using an annotated duty's
                modality change. It is not a claim about a real amendment in
                these RFCs.
              </p>
              <h4>{data.matched_changes.length} matched keyword changes</h4>
              <p>
                The strict sentence-matching method found no changed requirement
                pairs in the real comparison. That is a matching limitation, not
                evidence that nothing changed.
              </p>
            </section>
          </div>
          <details className="budget-method">
            <summary>Method, sources & limitations</summary>
            <p>
              The reader groups MUST/SHALL/REQUIRED, SHOULD/RECOMMENDED and
              MAY/OPTIONAL, including negative forms. It uses the first keyword
              per extracted sentence, skips quoted sentences and heuristically
              removes page furniture. Extraction recall has not been
              independently evaluated. It can miss multiple obligations,
              conditions, exceptions and rewritten requirements. Optional is
              displayed as optional, not missing data.
            </p>
            <p>
              Real drift needs reviewed matches for the same actor, action,
              polarity and scope. The engine's direction rules are tested
              separately from this reader. Counts measure extracted statements,
              not every requirement in a standard.
            </p>
            {data.versions.map((v) => (
              <p key={v.rfc}>
                <a href={v.url} target="_blank" rel="noreferrer">
                  RFC {v.rfc} source ↗
                </a>
                <small className="source-hash">
                  Snapshot SHA-256: {v.sha256}
                </small>
              </p>
            ))}
            <a
              href="https://www.rfc-editor.org/rfc/rfc2119"
              target="_blank"
              rel="noreferrer"
            >
              RFC 2119 requirement levels ↗
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/korv9/allegoria"
              target="_blank"
              rel="noreferrer"
            >
              Allegoria source ↗
            </a>
          </details>
        </>
      )}
    </article>
  )
}
