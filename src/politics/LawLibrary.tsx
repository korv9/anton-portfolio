import { useState } from 'react'
import { count, useData } from './data'
import LegislativeEvidence from './LegislativeEvidence'
type Law = {
  id: string
  pool: string
  title: string
  version: string
  provisions: number
  path: string
}
type Provision = {
  provision_id: string
  label: string
  text: string
  source_url: string
  source_page_url?: string
  source_sha256: string
  document_version?: string
}

function LawText({ law }: { law: Law }) {
  const { data, error } = useData<Provision[]>(law.path)
  const [query, setQuery] = useState('')
  return (
    <div className="law-text">
      <h5>{law.title}</h5>
      <p>{law.version} · snapshot, not verified as the law on a debate date.</p>
      <label>
        Search provisions
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {data
        ?.filter((p) => p.text.toLowerCase().includes(query.toLowerCase()))
        .map((p) => (
          <details key={p.provision_id}>
            <summary>{p.label || p.provision_id}</summary>
            <p lang="sv" className="source-text">
              {p.text}
            </p>
            <a
              href={p.source_url || p.source_page_url}
              target="_blank"
              rel="noreferrer"
            >
              Statute source ↗
            </a>
            <small className="source-hash">
              Source SHA-256: {p.source_sha256}
            </small>
          </details>
        ))}
    </div>
  )
}

export default function LawLibrary() {
  const laws = useData<Law[]>('laws/index.json')
  const [query, setQuery] = useState('')
  const [pool, setPool] = useState('v1')
  const [lawId, setLawId] = useState('')
  const matching =
    laws.data?.filter(
      (l) =>
        l.pool === pool &&
        `${l.title} ${l.id}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? []
  const selected = matching.find((l) => l.id === lawId)
  return (
    <section className="meaning-lab">
      <h3>Law texts & source evidence</h3>
      <p>
        Read the source snapshots and inspect the limits of proposed-law
        comparisons.
      </p>
      <section className="politics-card law-browser">
        <h4>Read the source law</h4>
        <p>
          Browse both available statute provision pools, with source hashes,
          snapshot versions and original text. Overlapping pools must not be
          added together as unique laws.
        </p>
        <div className="politics-controls">
          <label>
            Corpus pool
            <select
              value={pool}
              onChange={(e) => {
                setPool(e.target.value)
                setLawId('')
              }}
            >
              <option value="v1">v1 · frozen corpus</option>
              <option value="v2">v2 · expanded pool</option>
            </select>
          </label>
          <label>
            Search laws
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. anställning, miljö"
            />
          </label>
          <label>
            Law snapshot
            <select
              value={selected?.id ?? ''}
              onChange={(e) => setLawId(e.target.value)}
            >
              <option value="">
                Select from {count(matching.length)} snapshots
              </option>
              {matching.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {laws.error && <p role="alert">{laws.error}</p>}
        {selected && <LawText key={selected.path} law={selected} />}
      </section>
      <LegislativeEvidence />
    </section>
  )
}
