/**
 * The pieces every data page tells its story with, in the order a reader needs them:
 * question → answer → evidence → interpretation → explore → method.
 *
 * - DataQuestion: the section's question, with a number and a line of context.
 * - FindingHero: a major finding, a number that tells the story on its own and one sentence.
 * - Interpretation: "What this means", with an optional "What this does not mean".
 * - ExploreSection: filters, tables and secondary views, folded until asked for. Its children
 *   render only when open, so the overview stays light.
 * - MethodSummary: how it was built in one line of lineage, the one quality point that matters
 *   for this project, and links to Data Constellation and Quality & Validity.
 *
 * Two finding levels are visible in the CSS: major (FindingHero) and diagnostic
 * (`.story-diagnostic`, small, under Method).
 */
import { useState, type ReactNode } from 'react'
import { l } from '../i18n'
import './story.css'

export function DataQuestion({
  id,
  question,
  children,
  level = 2,
}: {
  id?: string
  question: string
  /** A short line of context under the question. */
  children?: ReactNode
  level?: 1 | 2
}) {
  const H = level === 1 ? 'h1' : 'h2'
  return (
    <header className="data-question">
      <H id={id}>{question}</H>
      {children && <div className="data-question-context">{children}</div>}
    </header>
  )
}

export function FindingHero({
  value,
  statement,
  comparison,
  source,
}: {
  value: string
  statement: ReactNode
  /** A second, smaller reading that puts the number in context. */
  comparison?: ReactNode
  source?: ReactNode
}) {
  return (
    <div className="finding-hero">
      <p className="finding-hero-value">{value}</p>
      <div>
        <p className="finding-hero-statement">{statement}</p>
        {comparison && <p className="finding-hero-comparison">{comparison}</p>}
        {source && <p className="source-caption">{source}</p>}
      </div>
    </div>
  )
}

export function Interpretation({
  children,
  notMeaning,
  title,
}: {
  children: ReactNode
  /** A short caveat: what the evidence does not show. */
  notMeaning?: ReactNode
  title?: string
}) {
  return (
    <section className="interpretation">
      <h3>{title ?? l('What this means', 'Vad det här betyder')}</h3>
      <div className="interpretation-body">{children}</div>
      {notMeaning && (
        <p className="interpretation-not">
          <b>{l('What it does not mean', 'Vad det inte betyder')}:</b>{' '}
          {notMeaning}
        </p>
      )}
    </section>
  )
}

export function ExploreSection({
  id,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  id?: string
  title?: string
  /** What is inside, so a reader knows whether to open it. */
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const heading = title ?? l('Explore the data', 'Utforska datan')
  return (
    <section
      className={open ? 'explore-section open' : 'explore-section'}
      id={id}
      aria-label={heading}
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span>{heading}</span>
          <span aria-hidden="true" className="explore-section-sign">
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>
      {summary && !open && <p className="explore-section-summary">{summary}</p>}
      {open && <div className="explore-section-body">{children}</div>}
    </section>
  )
}

/** The quality points that matter for one product, each a dimension and the evidence for it. */
export function QualityBrief({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <section
      className="quality-brief"
      aria-label={l('Quality in brief', 'Kvalitet i korthet')}
    >
      <h3>{l('Quality in brief', 'Kvalitet i korthet')}</h3>
      <dl>
        {rows.map(([dimension, evidence]) => (
          <div key={dimension}>
            <dt>{dimension}</dt>
            <dd>{evidence}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function MethodSummary({
  lineage,
  quality,
  more,
}: {
  /** The steps from the official source to this page. */
  lineage: string[]
  /** The one quality or validity point that matters most for this project. */
  quality: ReactNode
  /** Project-specific links (sources, method page). */
  more?: { href: string; label: string }[]
}) {
  return (
    <section
      className="method-summary"
      aria-label={l('How it was built', 'Så byggdes det')}
    >
      <div>
        <h3>{l('How it was built', 'Så byggdes det')}</h3>
        <p className="method-summary-lineage">{lineage.join(' → ')}</p>
      </div>
      <div>
        <h3>{l('Quality and validity', 'Kvalitet och validitet')}</h3>
        <p>{quality}</p>
      </div>
      {more && more.length > 0 && (
        <nav aria-label={l('Sources and method', 'Källor och metod')}>
          {more.map((m) => (
            <a key={m.href} href={m.href}>
              {m.label}
            </a>
          ))}
        </nav>
      )}
    </section>
  )
}
