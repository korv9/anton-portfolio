/**
 * Connections (#sweden-samband): a few explicitly defined relationships between the research
 * products, each with its measurement contract, result, uncertainty, confounders and
 * assessment, and the joins rejected because their grains do not meet
 * (sweden/connections/connections.json, platform/publish/sweden/export_connections.py).
 * Each relationship shows its chart or table; the rest is folded under one disclosure.
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
import { ExploreSection } from '../ui/Story'
import {
  EmptyState,
  EvidenceStamp,
  ProductEmpty,
  ProductSection,
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
      <p className="sw-section sw-note" role="status">
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
    <ProductSection product={product}>
      <header className="sw-scene-title">
        <p className="sw-kicker">
          <span className="sw-id">×</span>
          {l(product.title.en, product.title.sv)}
        </p>
        <h2 id="sw-title-X">{l(product.question.en, product.question.sv)}</h2>
        <p className="sw-line">
          {l(
            'Correlation, not causation: none of these is causally identified.',
            'Korrelation, inte orsak: inget av dessa är kausalt identifierat.',
          )}
        </p>
      </header>
      <div className="sw-connections">
        {data.relationships.map((r) => (
          <article
            key={r.id}
            className="sw-connection"
            data-assessment={r.assessment}
          >
            <h3>{r.question}</h3>
            <p className="sw-kicker">
              {r.products.join(' × ')} ·{' '}
              {l(ASSESSMENT[r.assessment][0], ASSESSMENT[r.assessment][1])}
            </p>
            {r.kind === 'gradient' ? (
              <GradientCard r={r} />
            ) : r.kind === 'neighbours' ? (
              <NeighbourPlot result={r.result} />
            ) : (
              <ChangeTable result={r.result} />
            )}
          </article>
        ))}
      </div>
      <ExploreSection
        title={l('Method and rejected joins', 'Metod och avvisade kopplingar')}
        summary={l(
          'Contracts, confounders, alternatives and the joins that were turned down.',
          'Kontrakt, störfaktorer, alternativ och kopplingarna som avvisades.',
        )}
      >
        {data.relationships.map((r) => (
          <div key={r.id} className="sw-method-body">
            <h3>{r.question}</h3>
            <p className="sw-kicker">
              <EvidenceStamp evidence={r.evidence} />
            </p>
            {r.kind !== 'gradient' && <Contract r={r} />}
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
          </div>
        ))}
        <h3>{l('Rejected joins', 'Avvisade kopplingar')}</h3>
        {data.rejected.map((r) => (
          <details key={r.id}>
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
      </ExploreSection>
    </ProductSection>
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
