/**
 * Connections (#sweden-samband): a few explicitly defined relationships between the research
 * products, each with its measurement contract, result, uncertainty, confounders and
 * assessment, and the joins rejected because their grains do not meet
 * (sweden/connections/connections.json, platform/publish/sweden/export_connections.py).
 * No 3D: compact cards with one chart or table per relationship.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import {
  ChangeTable,
  NeighbourPlot,
  type ChangeResult,
  type NeighboursResult,
} from './ConnectionsViews'
import { GradientCard, type Base, type Gradient } from './ConnectionsGradient'
import { productById } from './products'
import {
  EmptyState,
  EvidenceStamp,
  ProductEmpty,
  RelatedProjects,
  SwedenMasthead,
} from './template'

type Relationship =
  | Gradient
  | (Base & { kind: 'neighbours'; result: NeighboursResult })
  | (Base & { kind: 'change'; result: ChangeResult })
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
    test: string
    multiple_comparisons: string
    deviations: string[]
  }
}

const ASSESSMENT = {
  robust: ['Robust under the stated tests', 'Robust under angivna test'],
  uncertain: ['Uncertain', 'Osäker'],
  not_supported: ['Not supported', 'Stöds inte'],
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
            'Each relationship below is stated with its geography, years and denominator. The first was chosen by the authors after the data were available; the other two were pre-registered before they were computed. Holm-adjusted p-values stand beside the raw ones within each question, and no label rests on a p-value. Correlation is not causation, and none of these is causally identified.',
            'Varje samband nedan anges med geografi, år och nämnare. Det första valdes av författarna när data redan fanns; de två andra förregistrerades innan de beräknades. Holm-justerade p-värden står bredvid de ojusterade inom varje fråga, och ingen bedömning vilar på ett p-värde. Korrelation är inte orsak, och inget av dessa är kausalt identifierat.',
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
            {r.kind === 'gradient' ? (
              <GradientCard r={r} />
            ) : (
              <>
                <Contract r={r} />
                {r.kind === 'neighbours' ? (
                  <NeighbourPlot result={r.result} />
                ) : (
                  <ChangeTable result={r.result} />
                )}
              </>
            )}
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
            <p className="sw-note">
              {l('Specification', 'Specifikation')}: {r.specification}.
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
          {data.method.statistic}; {data.method.interval}; {data.method.test}.{' '}
          {data.method.multiple_comparisons}.
        </p>
        {data.method.deviations.length > 0 && (
          <p className="sw-note">
            {l(
              'Departures from the pre-registration',
              'Avvikelser från förregistreringen',
            )}
            : {data.method.deviations.join(' ')}
          </p>
        )}
      </section>
      <RelatedProjects product={product} />
    </article>
  )
}

function Contract({ r }: { r: Base }) {
  return (
    <dl className="sw-info-list">
      <div>
        <dt>{l('Geography', 'Geografi')}</dt>
        <dd>{r.contract.geography}</dd>
      </div>
      <div>
        <dt>{l('Time', 'Tid')}</dt>
        <dd>{r.contract.time}</dd>
      </div>
      <div>
        <dt>{l('Missing', 'Saknas')}</dt>
        <dd>{r.contract.missing}</dd>
      </div>
    </dl>
  )
}
