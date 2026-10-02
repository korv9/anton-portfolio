/**
 * The frame every politics dashboard shares: a heading with the slicers on the right, a row of
 * key figures, and cards in a grid. Unlike the overview (one fixed screen), a board scrolls:
 * each card is as tall as its chart needs.
 */
import type { ReactNode } from 'react'
import { l } from '../../i18n'
import { CountUp } from '../dash/motion'
import './board.css'

export function Board({
  title,
  sub,
  slicers,
  level = 1,
  children,
}: {
  title: ReactNode
  sub?: ReactNode
  slicers?: ReactNode
  /** The heading level: 2 when the board sits under a page's own heading. */
  level?: 1 | 2
  children: ReactNode
}) {
  const H = level === 1 ? 'h1' : 'h2'
  return (
    <div className="board">
      <header className="board-head">
        <div>
          <H className={level === 2 ? 'board-title-2' : undefined}>{title}</H>
          {sub && <p className="board-sub">{sub}</p>}
        </div>
        {slicers && (
          <div className="board-slicers" aria-label={l('Filters', 'Filter')}>
            {slicers}
          </div>
        )}
      </header>
      {children}
    </div>
  )
}

export function Kpis({ children }: { children: ReactNode }) {
  return <dl className="board-kpis">{children}</dl>
}

export function Kpi({
  label,
  value,
  format,
  sub,
  index,
}: {
  label: string
  value: number
  format: (v: number) => string
  sub?: string
  index: number
}) {
  return (
    <div className="dash-kpi" style={{ ['--i' as string]: index }}>
      <dt>{label}</dt>
      <dd>
        <CountUp value={value} format={format} />
      </dd>
      {sub && <dd className="dash-kpi-sub">{sub}</dd>}
    </div>
  )
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="board-grid">{children}</div>
}

export function Card({
  title,
  meta,
  href,
  more,
  index,
  wide = false,
  children,
}: {
  title: string
  meta?: string
  href?: string
  /** The link's text; "More" by default. */
  more?: string
  index: number
  /** Spans the full width of the grid. */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={wide ? 'board-card wide' : 'board-card'}
      style={{ ['--i' as string]: index }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        {href && <a href={href}>{more ?? l('More', 'Mer')} →</a>}
      </header>
      {meta && <p className="dash-meta">{meta}</p>}
      <div className="board-body">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children?: ReactNode }) {
  return <p className="dash-empty">{children ?? l('Loading…', 'Laddar…')}</p>
}
