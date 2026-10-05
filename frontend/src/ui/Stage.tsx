/**
 * The project dashboard frame: one large figure in the middle of the screen, the technical
 * details in narrow panels on either side. Narrower screens put the figure first and the panels
 * under it. Used on every project page, so each opens on one simple, striking chart.
 */
import type { ReactNode } from 'react'
import './stage.css'

export function Stage({
  id,
  kicker,
  title,
  lead,
  figure,
  left,
  right,
  dark = true,
  level = 2,
}: {
  id: string
  kicker: string
  title: string
  lead?: string
  figure: ReactNode
  left: ReactNode
  right: ReactNode
  dark?: boolean
  /** 1 when the stage opens the page and its title is the page's heading. */
  level?: 1 | 2
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <section
      className={`stage${dark ? ' is-dark' : ''}`}
      id={id}
      aria-labelledby={`${id}-title`}
    >
      <header className="stage-head">
        <p className="stage-kicker">{kicker}</p>
        <Heading id={`${id}-title`}>{title}</Heading>
        {lead && <p className="stage-lead">{lead}</p>}
      </header>
      <aside className="stage-side is-left">{left}</aside>
      <div className="stage-figure">{figure}</div>
      <aside className="stage-side is-right">{right}</aside>
    </section>
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
  return (
    <div className="stage-block">
      <h3>{title}</h3>
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
