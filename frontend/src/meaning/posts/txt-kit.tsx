/**
 * Shared bits for the text, law, ML and platform posts: sorted bars, a vertical grid for dot
 * plots, KPI tiles, a guard for data a chart cannot draw and a guard for titles. Exports no
 * posts of its own.
 */
import { useContext, type ReactNode } from 'react'
import { OTHER, PALETTE, PostOpen, type Post } from '../kit'
import { xTickY } from '../axes'
import RankBars, { type RankRow } from '../../charts/RankBars'
import './txt.css'

export const posts: Post[] = []

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const uniq = <T,>(xs: T[]) => [...new Set(xs)]
export const count = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return m
}
export const fmt = (n: number) =>
  n.toLocaleString('en', { maximumFractionDigits: n < 10 ? 2 : 0 })
export const pct = (n: number) => `${(n * 100).toFixed(0)}%`
/** An ISO date in words, read in UTC so 2026-08-02 never shows as 1 August. */
export const day = (d: string, withDay = true) =>
  new Date(d).toLocaleDateString('en-GB', {
    ...(withDay ? { day: 'numeric' } : {}),
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

export const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')

/** A label cut to n characters with an ellipsis, for SVG rows that cannot wrap. */
export const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s

/** Sentence case for the Act's upper-case headings, keeping AI and EU. */
export const sentence = (s: string) => {
  const t = s.toLowerCase().replace(/\b(ai|eu)\b/g, (w) => w.toUpperCase())
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Loaded data the chart cannot draw (no rows, a missing key, an unexpected shape) becomes an
 * Error naming the file, so Frame shows the failure state, or the thumbnail leaves the feed,
 * instead of an empty or broken chart.
 */
export function usable<T>(
  data: T | null | Error,
  path: string,
  ok: (d: T) => unknown,
): T | null | Error {
  if (data === null || data instanceof Error) return data
  try {
    return ok(data) ? data : new Error(`${path} (nothing to draw)`)
  } catch {
    return new Error(`${path} (unexpected shape)`)
  }
}

/** A title function that gives no title rather than one with NaN, Infinity or undefined in
 * it; a title that throws is left empty by the card. */
export const heading =
  <T,>(f: (d: T) => string) =>
  (d: T) => {
    const t = f(d)
    return /NaN|Infinity|undefined|null/.test(t) ? '' : t
  }

/**
 * Sorted horizontal bars (charts/RankBars) at card size: grey bars, the focal row in the
 * accent (the first row unless `focus` names another). A thumbnail shows the first `limit`
 * rows and says how many more the opened post lists.
 */
export function Bars({
  rows,
  format,
  label,
  focus,
  limit = 10,
  long = false,
  max,
}: {
  rows: RankRow[]
  format: (v: number) => string
  label: string
  focus?: string | null
  limit?: number
  /** A wider label column, for names that carry the meaning. */
  long?: boolean
  /** A fixed scale, e.g. 1 for shares; otherwise the largest value. */
  max?: number
}) {
  const open = useContext(PostOpen)
  const shown = open ? rows : rows.slice(0, limit)
  const key = focus === undefined ? rows[0]?.key : focus
  return (
    <div
      className={long ? 'mean-bars mean-txt-long' : 'mean-bars'}
      data-hidden={rows.length - shown.length}
    >
      <RankBars
        rows={shown.map((r) => ({
          ...r,
          color: r.color ?? (r.key === key ? PALETTE[0] : OTHER),
        }))}
        format={format}
        label={label}
        max={max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9)}
      />
    </div>
  )
}

/** Vertical gridlines from y0 to y1 with tick labels under them, for horizontal value axes. */
export function XGrid({
  x,
  ticks,
  y0,
  y1,
  format = String,
}: {
  x: (v: number) => number
  ticks: number[]
  y0: number
  y1: number
  format?: (v: number) => string
}) {
  return (
    <g className="mean-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y0} y2={y1} />
          <text x={x(t)} {...xTickY(y1 + 12)} textAnchor="middle">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Up to four plain numbers with their labels: no colour, since none is focal. */
export function Kpis({ items }: { items: [ReactNode, string][] }) {
  return (
    <div className="mean-txt-kpis">
      {items.map(([v, label]) => (
        <div key={label}>
          {v}
          <small>{label}</small>
        </div>
      ))}
    </div>
  )
}

export function Svg({
  w,
  h,
  label,
  children,
}: {
  w: number
  h: number
  label: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
    </svg>
  )
}

export function Kpi({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <div className="mean-txt-kpi">
      {value}
      <small>{unit}</small>
    </div>
  )
}
