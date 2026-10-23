/**
 * Shared bits for the politics posts: party colours, a legend, axis ticks, squarified treemap
 * and arc geometry. Exports no posts of its own.
 */
import type { ReactNode } from 'react'
import type { Post } from '../kit'
import './pol.css'

export const posts: Post[] = []

/** Left to right on the usual bloc axis. */
export const PARTIES = ['V', 'S', 'MP', 'C', 'L', 'KD', 'M', 'SD'] as const

/** Swedish party colours, muted to the feed's palette (meaning.css sets them per theme): S red,
 * V a deeper red, M, L and KD in blues, SD yellow, C and MP in greens. */
const PARTY_COLOR: Record<string, string> = Object.fromEntries(
  [...PARTIES, 'NYD'].map((p) => [p, `var(--mean-party-${p.toLowerCase()})`]),
)
PARTY_COLOR.OTHER = 'var(--line-strong)'

export const pc = (p: string) => PARTY_COLOR[p] ?? 'var(--line-strong)'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const uniq = <T,>(xs: T[]) => [...new Set(xs)]
export const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    m.set(k, [...(m.get(k) ?? []), x])
  }
  return m
}

/** Polyline path through points, skipping nothing. */
export const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')

/** Closed area between an upper and a lower line. */
export const band = (top: [number, number][], bottom: [number, number][]) =>
  `${line(top)}${line([...bottom].reverse()).replace('M', 'L')}Z`

/** Annular sector from angle a0 to a1 (radians, 0 = up, clockwise). */
export function arc(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
) {
  const p = (r: number, a: number) =>
    `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`
  const big = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r1, a0)}A${r1},${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${big} 0 ${p(r0, a0)}Z`
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.): lays values, largest first, into the rectangle. */
export function squarify<T>(items: T[], value: (t: T) => number, box: Rect) {
  const total = sum(items.map(value)) || 1
  const scale = (box.w * box.h) / total
  const queue = [...items].sort((a, b) => value(b) - value(a))
  const out: (Rect & { item: T })[] = []
  let { x, y, w, h } = box
  const worst = (row: number[], side: number) => {
    const s = sum(row)
    return Math.max(
      ...row.map((r) =>
        Math.max((side * side * r) / (s * s), (s * s) / (side * side * r)),
      ),
    )
  }
  while (queue.length) {
    const side = Math.min(w, h)
    const row: T[] = [queue.shift()!]
    while (queue.length) {
      const now = row.map((t) => value(t) * scale)
      const next = [...now, value(queue[0]) * scale]
      if (worst(next, side) > worst(now, side)) break
      row.push(queue.shift()!)
    }
    const area = sum(row.map((t) => value(t) * scale))
    const thick = area / side
    let off = 0
    for (const t of row) {
      const len = (value(t) * scale) / thick
      out.push(
        w >= h
          ? { x, y: y + off, w: thick, h: len, item: t }
          : { x: x + off, y, w: len, h: thick, item: t },
      )
      off += len
    }
    if (w >= h) ((x += thick), (w -= thick))
    else ((y += thick), (h -= thick))
  }
  return out
}

export function Legend({ items }: { items: string[] }) {
  return (
    <div className="mean-legend">
      {items.map((p) => (
        <span key={p}>
          <i style={{ background: pc(p) }} />
          {p}
        </span>
      ))}
    </div>
  )
}

/** Horizontal tick labels along the bottom of a chart. */
export function XTicks({
  ticks,
  y,
}: {
  ticks: { x: number; label: ReactNode }[]
  y: number
}) {
  return (
    <g className="mean-pol-t" textAnchor="middle">
      {ticks.map((t, i) => (
        <text key={i} x={t.x} y={y}>
          {t.label}
        </text>
      ))}
    </g>
  )
}

/** Value gridlines with labels at the left edge. */
export function YGrid({
  ticks,
  x0,
  x1,
  y,
}: {
  ticks: number[]
  x0: number
  x1: number
  y: (v: number) => number
}) {
  return (
    <g className="mean-pol-t">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} className="mean-pol-grid" />
          <text x={x0 - 3} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Every nth item, for tick thinning. */
export const every = <T,>(xs: T[], n: number) =>
  xs.filter((_, i) => i % n === 0)
