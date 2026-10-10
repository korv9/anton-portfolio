/**
 * The project dashboard frame: one large figure in the middle of the screen, the technical
 * details in narrow panels on either side. Narrower screens put the figure first and the panels
 * under it. Used on every project page, so each opens on one simple, striking chart.
 */
import { createContext, useContext, type ReactNode } from 'react'
import './stage.css'

// The stage's heading level, so a side panel's block headings sit one level under it.
const StageLevel = createContext<1 | 2>(2)

export function Stage({
  id,
  kicker,
  title,
  lead,
  figure,
  left,
  right,
  dark = false,
  level = 2,
  metrics,
}: {
  id: string
  kicker?: string
  title: string
  lead?: string
  figure: ReactNode
  left: ReactNode
  right: ReactNode
  dark?: boolean
  /** 1 when the stage opens the page and its title is the page's heading. */
  level?: 1 | 2
  metrics?: ReactNode
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <StageLevel.Provider value={level}>
      <section
        className={`stage${dark ? ' is-dark plate' : ''}${metrics ? ' has-metrics' : ''}`}
        id={id}
        aria-labelledby={`${id}-title`}
      >
        <header className="stage-head">
          {kicker && <p className="stage-kicker">{kicker}</p>}
          <Heading id={`${id}-title`}>{title}</Heading>
          {lead && <p className="stage-lead">{lead}</p>}
        </header>
        {metrics && <div className="stage-metrics">{metrics}</div>}
        <aside className="stage-side is-left">{left}</aside>
        <div className="stage-figure">{figure}</div>
        <aside className="stage-side is-right">{right}</aside>
      </section>
    </StageLevel.Provider>
  )
}

/** One technical block in a side panel: a small heading and its content. */
export function StageBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const Heading = useContext(StageLevel) === 1 ? 'h2' : 'h3'
  return (
    <div className="stage-block">
      <Heading className="stage-block-title">{title}</Heading>
      {children}
    </div>
  )
}

/** Label–value rows for a side panel. */
export function StageFacts({
  rows,
}: {
  rows: [label: string, value: ReactNode][]
}) {
  return (
    <dl className="stage-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A short list of tools as plain text. */
export function StageTools({ items }: { items: string[] }) {
  return (
    <ul className="stage-tools">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}
