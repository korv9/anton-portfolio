/**
 * Small SVG parts shared by the wel-* posts: extents, paths, axes, legends and a squarified
 * treemap. Exports no posts of its own.
 */
import type { ReactNode } from 'react'
import { linearScale, niceTicks } from '../../charts/scales'
import { color, type Post } from '../kit'
import './wel.css'

export const posts: Post[] = []

export const num = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)

export function extent(values: number[]): [number, number] {
  const v = values.filter(num)
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1]
}

export const scale = linearScale

export function path(points: [number, number][]) {
  return points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')
}

/** A closed band between two y-lines that share x positions. */
export function band(xs: number[], top: number[], bottom: number[]) {
  const upper = xs.map((x, i) => [x, top[i]] as [number, number])
  const lower = xs.map((x, i) => [x, bottom[i]] as [number, number]).reverse()
  return `${path(upper)}L${path(lower).slice(1)}Z`
}

export function fmt(v: number, digits = 1) {
  const a = Math.abs(v)
  if (a >= 1e6) return `${(v / 1e6).toFixed(digits)}M`
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`
  return v.toLocaleString('en-GB', { maximumFractionDigits: digits })
}

export function groupBy<T, K>(rows: T[], key: (r: T) => K) {
  const out = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(r)
  }
  return out
}

export function Svg({
  w = 400,
  h = 400,
  label,
  children,
}: {
  w?: number
  h?: number
  label: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className="mean-wel-svg"
    >
      {children}
    </svg>
  )
}

export function Legend({ items }: { items: string[] }) {
  return (
    <div className="mean-legend">
      {items.map((t, i) => (
        <span key={t}>
          <i style={{ background: color(i) }} />
          {t}
        </span>
      ))}
    </div>
  )
}

/** Horizontal gridlines with left tick labels from 0 (or `min`) to a nice max. */
export function YAxis({
  max,
  min = 0,
  x0,
  x1,
  y0,
  y1,
}: {
  max: number
  min?: number
  x0: number
  x1: number
  y0: number
  y1: number
}) {
  const ticks = niceTicks(max - min, 4).map((t) => t + min)
  const top = ticks[ticks.length - 1]
  const y = scale([min, top], [y0, y1])
  return (
    <g className="mean-wel-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
          <text x={x0 - 4} y={y(t) + 3} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Tick labels along the bottom for a few evenly spread values. */
export function XTicks({
  values,
  x,
  y,
  every = 1,
}: {
  values: (number | string)[]
  x: (i: number) => number
  y: number
  every?: number
}) {
  return (
    <g className="mean-wel-axis">
      {values.map((v, i) =>
        i % every ? null : (
          <text key={i} x={x(i)} y={y} textAnchor="middle">
            {v}
          </text>
        ),
      )}
    </g>
  )
}

/** The top of a nice axis for `max`, so bars and axis share a scale. */
export const niceMax = (max: number) => {
  const t = niceTicks(max, 4)
  return t[t.length - 1]
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.) for positive values, largest first. */
export function squarify(values: number[], box: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0)
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a])
  const out: Rect[] = new Array(values.length)
  let { x, y, w, h } = box
  const area = (w * h) / (total || 1)
  let row: number[] = []
  const worst = (r: number[], side: number) => {
    const s = r.reduce((a, i) => a + values[i] * area, 0)
    const max = Math.max(...r.map((i) => values[i] * area))
    const min = Math.min(...r.map((i) => values[i] * area))
    return Math.max(
      (side * side * max) / (s * s),
      (s * s) / (side * side * min),
    )
  }
  const layout = (r: number[]) => {
    const s = r.reduce((a, i) => a + values[i] * area, 0)
    const wide = w >= h
    const thick = s / (wide ? h : w)
    let offset = 0
    for (const i of r) {
      const len = (values[i] * area) / thick
      out[i] = wide
        ? { x, y: y + offset, w: thick, h: len }
        : { x: x + offset, y, w: len, h: thick }
      offset += len
    }
    if (wide) {
      x += thick
      w -= thick
    } else {
      y += thick
      h -= thick
    }
  }
  for (const i of order) {
    if (values[i] <= 0) {
      out[i] = { x, y, w: 0, h: 0 }
      continue
    }
    const side = Math.min(w, h)
    if (row.length && worst([...row, i], side) > worst(row, side)) {
      layout(row)
      row = []
    }
    row.push(i)
  }
  if (row.length) layout(row)
  return out
}

/** One arc slice of a ring from angle a0 to a1 (radians, 0 at 12 o'clock). */
export function arc(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
) {
  const p = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`
}

export function Kpi({
  value,
  unit,
  delta,
}: {
  value: string
  unit?: string
  delta?: number
}) {
  return (
    <div className="mean-wel-kpi">
      <b>{value}</b>
      {unit ? <span>{unit}</span> : null}
      {delta !== undefined && num(delta) ? (
        <em data-up={delta > 0}>
          {delta > 0 ? '+' : ''}
          {fmt(delta, 2)}
        </em>
      ) : null}
    </div>
  )
}
