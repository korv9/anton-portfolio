/**
 * Shared bits for the jobs posts: dataset paths, number formats, a legend, a KPI tile, axis
 * ticks, line paths and a squarified treemap. Exports no posts of its own.
 */
import { useContext, type ReactNode } from 'react'
import RankBars, { type RankRow } from '../../charts/RankBars'
import { focal, OTHER, PostOpen, tile, type Post } from '../kit'
import { FIELD_EN, type Market } from '../../jobs/market'
import './job.css'

export const posts: Post[] = []
export type { Market }

export const D = 'jobs'
export const MARKET = 'jobs/market.json'
/** A county with a name: ads without one sit under 'Okänt län' ('unknown county'). */
export const knownRegion = (r: { region: string }) =>
  r.region !== 'unknown' && !r.region.startsWith('Okänt')
export const CLUSTERS = 'jobs/cluster-summary.json'
export const PREVIEW = 'jobs/cluster-preview.json'
export const COMPANIES = 'jobs/company-intelligence.json'
export const WORKSPACE = 'jobs/workspace.json'

export const fieldName = (sv: string) => FIELD_EN[sv] ?? sv
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const uniq = <T,>(xs: T[]) => [...new Set(xs)]
export const fmt = (n: number) => Math.round(n).toLocaleString('en-GB')
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)} %`
export const compact = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

/** Count occurrences into [key, count] sorted by count, largest first. */
export function tally(keys: string[]) {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

/** Colour swatches with labels; the labels are the legend text. */
export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mean-legend">
      {items.map(([label, c], i) => (
        <span key={`${i}-${label}`}>
          <i style={{ background: c }} />
          {label}
        </span>
      ))}
    </div>
  )
}

/** A giant single number with its unit, on the focal tint. */
export function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="mean-job-big" style={tile(focal(true))}>
      <b>{value}</b>
      <span>{unit}</span>
    </div>
  )
}

/** A grid of numbers with units, one per cell. */
export function KpiGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mean-job-kpis">
      {items.map(([v, u], i) => (
        <div key={i} style={{ borderColor: OTHER }}>
          <b>{v}</b>
          <span>{u}</span>
        </div>
      ))}
    </div>
  )
}

/** An svg chart surface with an accessible name. */
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
      className="mean-job-svg"
    >
      {children}
    </svg>
  )
}

/** Horizontal gridlines with value labels at the left edge. */
export function YTicks({
  ticks,
  y,
  x0,
  x1,
  f = compact,
}: {
  ticks: number[]
  y: (v: number) => number
  x0: number
  x1: number
  f?: (v: number) => string
}) {
  return (
    <g className="mean-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
          <text x={x0 - 4} y={y(t) + 3} textAnchor="end">
            {f(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Year labels along the bottom at given x positions. */
export function XLabels({
  items,
  y,
}: {
  items: { x: number; label: string }[]
  y: number
}) {
  return (
    <g className="mean-axis">
      {items.map((t) => (
        <text key={t.label + t.x} x={t.x} y={y} textAnchor="middle">
          {t.label}
        </text>
      ))}
    </g>
  )
}

export type { RankRow }

/** A signed percentage change, e.g. +12 % or −8 %, with a true minus sign. */
export const change = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} %`

/** The first and last `k` rows of a ranked list: the largest rises and falls. */
export const ends = <T,>(rows: T[], k = 5) =>
  rows.length > 2 * k ? [...rows.slice(0, k), ...rows.slice(-k)] : rows

/**
 * charts/RankBars in a card: `thumb` (or the first `n` rows) in the thumbnail, every row once
 * opened. The scale is fixed by all rows, so the thumbnail's bars match the opened chart.
 */
export function Bars({
  rows,
  n = 10,
  thumb,
  format,
  label,
}: {
  rows: RankRow[]
  n?: number
  thumb?: RankRow[]
  format: (v: number) => string
  label: string
}) {
  const open = useContext(PostOpen)
  return (
    <div className={open ? 'mean-bars mean-job-all' : 'mean-bars'}>
      <RankBars
        rows={open ? rows : (thumb ?? rows.slice(0, n))}
        format={format}
        label={label}
        max={Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)))}
      />
    </div>
  )
}

export const linePath = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')

/** Closed band between an upper and a lower line, for stacked areas and streams. */
export const bandPath = (top: [number, number][], bottom: [number, number][]) =>
  `${linePath(top)}L${linePath([...bottom].reverse()).slice(1)}Z`

export type Rect = { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.) of positive values into a rectangle, in input order. */
export function squarify<T>(
  items: T[],
  value: (t: T) => number,
  box: Rect,
): (Rect & { item: T })[] {
  const nodes = items
    .map((item) => ({ item, v: value(item) }))
    .filter((n) => n.v > 0)
    .sort((a, b) => b.v - a.v)
  const total = sum(nodes.map((n) => n.v))
  const scale = (box.w * box.h) / (total || 1)
  const out: (Rect & { item: T })[] = []
  let { x, y, w, h } = box
  let row: { item: T; a: number }[] = []
  const worst = (r: { a: number }[], side: number) => {
    const s = sum(r.map((n) => n.a))
    const mx = Math.max(...r.map((n) => n.a))
    const mn = Math.min(...r.map((n) => n.a))
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  const flush = () => {
    const s = sum(row.map((n) => n.a))
    if (w >= h) {
      const rw = s / h
      let yy = y
      for (const n of row) {
        out.push({ item: n.item, x, y: yy, w: rw, h: n.a / rw })
        yy += n.a / rw
      }
      x += rw
      w -= rw
    } else {
      const rh = s / w
      let xx = x
      for (const n of row) {
        out.push({ item: n.item, x: xx, y, w: n.a / rh, h: rh })
        xx += n.a / rh
      }
      y += rh
      h -= rh
    }
    row = []
  }
  for (const n of nodes) {
    const a = n.v * scale
    const side = Math.min(w, h)
    if (row.length && worst([...row, { a }], side) > worst(row, side)) flush()
    row.push({ item: n.item, a })
  }
  if (row.length) flush()
  return out
}

/** Arc segment path for donuts and sunbursts, angles in radians from 12 o'clock. */
export function arc(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
) {
  a1 = Math.min(a1, a0 + 2 * Math.PI - 1e-4)
  const p = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`
}
