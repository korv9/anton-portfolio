/**
 * Shared quality components: status marks and a product's compact quality panel. Status is
 * always a shape and a word, never colour alone:
 * ● pass · △ warning · × fail · ○ not measured · – not applicable.
 */
import { l } from '../i18n'
import { cellOf, cellText } from './logic'
import { useQuality } from './data'
import type { QualityData, QualityStatus, ValidityStatus } from './types'
import './quality.css'

export const STATUS_TEXT: Record<QualityStatus, [string, string]> = {
  pass: ['pass', 'godkänd'],
  warning: ['warning', 'varning'],
  fail: ['fail', 'underkänd'],
  not_measured: ['not measured', 'ej mätt'],
  not_applicable: ['not applicable', 'ej tillämpligt'],
}
export const VALIDITY_TEXT: Record<ValidityStatus, [string, string]> = {
  supported: ['supported', 'stöds'],
  warning: ['warning', 'varning'],
  insufficient_evidence: ['insufficient evidence', 'otillräckligt underlag'],
  invalidated: ['invalidated', 'underkänd'],
  not_evaluated: ['not evaluated', 'ej utvärderad'],
}
const GLYPH: Record<QualityStatus | ValidityStatus, string> = {
  pass: 'pass',
  supported: 'pass',
  warning: 'warning',
  fail: 'fail',
  invalidated: 'fail',
  not_measured: 'open',
  insufficient_evidence: 'open',
  not_evaluated: 'open',
  not_applicable: 'dash',
}

/** The glyph alone (decorative); always paired with text by the caller. */
export function Glyph({ status }: { status: QualityStatus | ValidityStatus }) {
  const g = GLYPH[status]
  return (
    <svg
      className={`q-glyph q-glyph-${g}`}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      {g === 'pass' && <circle cx="6" cy="6" r="4" />}
      {g === 'open' && <circle cx="6" cy="6" r="3.6" />}
      {g === 'warning' && <path d="M6 1.6 10.6 10H1.4Z" />}
      {g === 'fail' && <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />}
      {g === 'dash' && <path d="M2.5 6H9.5" />}
    </svg>
  )
}

export function StatusMark({
  status,
  validity = false,
}: {
  status: QualityStatus | ValidityStatus
  validity?: boolean
}) {
  const text = validity
    ? VALIDITY_TEXT[status as ValidityStatus]
    : STATUS_TEXT[status as QualityStatus]
  return (
    <span className={`q-mark q-mark-${GLYPH[status]}`}>
      <Glyph status={status} /> {l(...text)}
    </span>
  )
}

/**
 * A product's compact "Quality & validity" section: its dimensions with their measured results,
 * and its main analytical question, confounder and conclusion. Links to #quality for the
 * checks behind every mark.
 */
export function ProductQuality({
  product,
  id,
  intro,
}: {
  product: string
  id?: string
  intro?: [string, string]
}) {
  const { data } = useQuality()
  if (!data) return null
  return (
    <ProductQualityView data={data} product={product} id={id} intro={intro} />
  )
}

export function ProductQualityView({
  data,
  product,
  id,
  intro,
}: {
  data: QualityData
  product: string
  id?: string
  intro?: [string, string]
}) {
  const checks = data.checks.filter((c) => c.product_id === product)
  const analyses = data.validity.filter((a) => a.product_id === product)
  if (!checks.length && !analyses.length) return null
  const dims = data.summary.dimensions.filter((d) =>
    checks.some((c) => c.dimension === d.id),
  )
  const main = analyses[0]
  const confounder = main?.confounders?.[0]
  return (
    <section className="q-panel" id={id} aria-labelledby={`q-panel-${product}`}>
      <h2 id={`q-panel-${product}`} className="q-panel-title">
        {l('Quality & validity', 'Kvalitet och validitet')}
      </h2>
      {intro && <p className="q-muted">{l(...intro)}</p>}
      <div className="q-panel-grid">
        <div>
          <p className="q-kicker">{l('Data quality', 'Datakvalitet')}</p>
          <dl className="q-dims">
            {dims.map((d) => {
              const cell = cellOf(checks.filter((c) => c.dimension === d.id))!
              return (
                <div key={d.id}>
                  <dt>
                    {l(d.label_en, d.label_sv)}
                    <small>{l(d.question_en, d.question_sv)}</small>
                  </dt>
                  <dd>
                    <StatusMark status={cell.status} />
                    <small>{cellText(cell, l)}</small>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
        {main && (
          <div>
            <p className="q-kicker">
              {l('Analytical validity', 'Analytisk validitet')}
            </p>
            <dl className="q-validity-brief">
              <div>
                <dt>{l('Question', 'Fråga')}</dt>
                <dd>
                  {l(main.question_en, main.question_sv ?? main.question_en)}
                </dd>
              </div>
              {confounder && (
                <div>
                  <dt>{l('Known confounder', 'Känd störfaktor')}</dt>
                  <dd>{confounder.confounder}</dd>
                </div>
              )}
              <div>
                <dt>{l('Current conclusion', 'Nuvarande slutsats')}</dt>
                <dd>
                  <StatusMark status={main.analysis_status} validity />{' '}
                  {l(
                    main.conclusion_en,
                    main.conclusion_sv ?? main.conclusion_en,
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
