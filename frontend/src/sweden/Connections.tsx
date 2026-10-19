/**
 * Connections (#sweden-samband): a few explicitly defined relationships between the research
 * products, each with its measurement contract, result, uncertainty, confounders and
 * assessment, and the joins rejected because their grains do not meet
 * (sweden/connections/connections.json, platform/publish/sweden/export_connections.py).
 * No 3D: compact cards and one scatter per relationship.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import { productById } from './products'
import {
  EmptyState,
  EvidenceStamp,
  ProductEmpty,
  RelatedProjects,
  SwedenMasthead,
} from './template'
import type { Evidence } from './products'

type Relationship = {
  id: string
  products: string[]
  question: string
  x: { name: string; unit: string; source: string }
  y: { name: string; unit: string; source: string; denominator: string }
  contract: { geography: string; time: string; missing: string }
  confounders: string[]
  result: {
    n: number
    excluded: number
    rho: number
    ci95: [number, number]
    partial_rho_log_population: number
    points: [string, number, number][]
  }
  evidence: Evidence
  assessment: 'robust' | 'uncertain' | 'not_supported' | 'trivial'
  alternatives: string[]
}
type Data = {
  relationships: Relationship[]
  rejected: {
    id: string
    products: string[]
    question: string
    reason: string
  }[]
  method: {
    statistic: string
    interval: string
    partial: string
    multiple_comparisons: string
  }
}

const ASSESSMENT = {
  robust: ['Robust under the stated tests', 'Robust under angivna test'],
  uncertain: ['Uncertain', 'Osäker'],
  not_supported: ['Not supported', 'Stöds inte'],
  trivial: ['Trivial: follows from the measure', 'Trivial: följer av måttet'],
} as const

export default function Connections() {
  const product = productById('X')
  const [data, setData] = useState<Data | 'error' | null>(null)
  useEffect(() => {
    fetchJson<Data>('sweden/connections/connections.json').then(setData, () =>
      setData('error'),
    )
  }, [])
  if (data === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (data === 'error')
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="validation"
          shows={l(
            'Relationships between the research products.',
            'Samband mellan forskningsprodukterna.',
          )}
          needs={l(
            'sweden/connections/connections.json.',
            'sweden/connections/connections.json.',
          )}
        />
      </ProductEmpty>
    )
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current={product.href} />
      <header className="sw-hub-head">
        <p className="sw-kicker">
          <span className="sw-id">×</span> SWEDEN
        </p>
        <h1 id="sw-title">{l(product.title.en, product.title.sv)}</h1>
        <p className="sw-question">
          {l(product.question.en, product.question.sv)}
        </p>
        <p className="sw-note">
          {l(
            `Each relationship below was defined before it was computed, on a shared geography and year. ${data.method.multiple_comparisons}. Correlation is not causation, and none of these is causally identified.`,
            `Varje samband nedan definierades innan det beräknades, på samma geografi och år. Flera samband prövas; inget kallas signifikant. Korrelation är inte orsak, och inget av dessa är kausalt identifierat.`,
          )}
        </p>
      </header>
      <section
        className="sw-findings"
        aria-label={l('Relationships', 'Samband')}
      >
        {data.relationships.map((r) => (
          <article
            key={r.id}
            className="sw-connection"
            data-assessment={r.assessment}
          >
            <h2>{r.question}</h2>
            <p className="sw-kicker">
              {r.products.map((p) => (
                <span key={p} className="sw-id">
                  {p}
                </span>
              ))}
              <span className="sw-stamp">
                {l(ASSESSMENT[r.assessment][0], ASSESSMENT[r.assessment][1])}
              </span>
              <EvidenceStamp evidence={r.evidence} />
            </p>
            <div className="sw-connection-grid">
              <dl className="sw-info-list">
                <div>
                  <dt>x</dt>
                  <dd>
                    {r.x.name} ({r.x.unit}) — {r.x.source}
                  </dd>
                </div>
                <div>
                  <dt>y</dt>
                  <dd>
                    {r.y.name} ({r.y.unit}) — {r.y.source}
                  </dd>
                </div>
                <div>
                  <dt>{l('Geography', 'Geografi')}</dt>
                  <dd>{r.contract.geography}</dd>
                </div>
                <div>
                  <dt>{l('Time', 'Tid')}</dt>
                  <dd>{r.contract.time}</dd>
                </div>
                <div>
                  <dt>{l('Denominator', 'Nämnare')}</dt>
                  <dd>{r.y.denominator}</dd>
                </div>
                <div>
                  <dt>{l('Missing', 'Saknas')}</dt>
                  <dd>
                    {r.contract.missing} ({r.result.excluded})
                  </dd>
                </div>
                <div>
                  <dt>Spearman ρ</dt>
                  <dd className="sw-mono">
                    {r.result.rho.toFixed(2)} [{r.result.ci95[0].toFixed(2)},{' '}
                    {r.result.ci95[1].toFixed(2)}], n = {r.result.n}
                  </dd>
                </div>
                <div>
                  <dt>{l('Population held constant', 'Folkmängd konstant')}</dt>
                  <dd className="sw-mono">
                    ρ = {r.result.partial_rho_log_population.toFixed(2)}
                  </dd>
                </div>
              </dl>
              <Scatter r={r} />
            </div>
            <p>
              <b>{l('Confounders', 'Störfaktorer')}:</b>{' '}
              {r.confounders.join('; ')}.
            </p>
            <p>
              <b>
                {l('Alternative explanations', 'Alternativa förklaringar')}:
              </b>{' '}
              {r.alternatives.join(' ')}
            </p>
          </article>
        ))}
      </section>
      <section className="sw-method" aria-labelledby="sw-rejected">
        <h2 id="sw-rejected">{l('Rejected joins', 'Avvisade kopplingar')}</h2>
        {data.rejected.map((r) => (
          <details key={r.id} open>
            <summary>
              {r.products.join(' × ')}: {r.question}
            </summary>
            <div className="sw-method-body">{r.reason}</div>
          </details>
        ))}
        <p className="sw-note">
          {data.method.statistic}; {data.method.interval}; {data.method.partial}
          .
        </p>
      </section>
      <RelatedProjects product={product} />
    </article>
  )
}

/** The relationship's points on rank axes, with a table under it for exact values. */
function Scatter({ r }: { r: Relationship }) {
  const W = 320
  const H = 240
  const xs = r.result.points.map((p) => p[1])
  const ys = r.result.points.map((p) => p[2])
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const px = (v: number) => 30 + ((v - x0) / (x1 - x0 || 1)) * (W - 40)
  const py = (v: number) => H - 25 - ((v - y0) / (y1 - y0 || 1)) * (H - 35)
  return (
    <figure className="sw-scatter">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${r.y.name} against ${r.x.name}, ${r.result.n} municipalities`}
      >
        <line x1={30} y1={H - 25} x2={W - 10} y2={H - 25} />
        <line x1={30} y1={10} x2={30} y2={H - 25} />
        {r.result.points.map(([code, x, y]) => (
          <circle key={code} cx={px(x)} cy={py(y)} r={2.2} />
        ))}
        <text x={W - 10} y={H - 8} textAnchor="end">
          {r.x.name}
        </text>
        <text x={34} y={18}>
          {r.y.name}
        </text>
      </svg>
      <figcaption className="sw-note">
        {l('Each point is a municipality.', 'Varje punkt är en kommun.')}
      </figcaption>
    </figure>
  )
}
