/**
 * The head every project page shares, as "What does it even mean?" reads: the name, one
 * sentence, a short row of KPIs. Charts follow with a legend only; method folds away (Method).
 */
import type { ReactNode } from 'react'
import './page-head.css'

export type Kpi = { value: ReactNode; label: string }

export default function PageHead({
  title,
  sentence,
  kpis = [],
}: {
  title: string
  sentence: string
  kpis?: Kpi[]
}) {
  return (
    <header className="page-head">
      <h1 className="page-head-title">{title}</h1>
      <p className="page-head-sentence">{sentence}</p>
      {kpis.length > 0 && (
        <dl className="page-head-kpis">
          {kpis.map((k) => (
            <div key={k.label}>
              <dt>{k.label}</dt>
              <dd>{k.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

/** A chart's legend: what it measures, the unit and the period, and its source. Nothing more. */
export function Legend({
  children,
  source,
}: {
  children: ReactNode
  source?: string
}) {
  return (
    <p className="page-legend">
      <span>{children}</span>
      {source && <span className="page-legend-source">{source}</span>}
    </p>
  )
}

/** How the page is made, closed by default. */
export function Method({
  summary,
  children,
}: {
  summary: string
  children: ReactNode
}) {
  return (
    <details className="page-method">
      <summary>{summary}</summary>
      <div className="page-method-body">{children}</div>
    </details>
  )
}
