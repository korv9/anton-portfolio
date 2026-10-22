/**
 * Shared bits for the text, law, ML and platform posts: geometry, a legend, a KPI tile and a
 * squarified treemap. Exports no posts of its own.
 */
import type { ReactNode } from 'react'
import { color, type Post } from '../kit'
import { niceStep } from '../../charts/scales'
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
/** Colour per category, in first-seen order. */
export const palette = (keys: string[]) =>
  new Map(keys.map((k, i) => [k, color(i)] as const))

/** Nice ticks inside [a, b], for axes that do not start at zero. */
export function ticksIn([a, b]: [number, number], n = 4) {
  const step = niceStep(b - a, n)
  const out: number[] = []
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step)
    out.push(+v.toFixed(10))
  return out
}

export const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')

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
    `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`
  const big = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r1, a0)}A${r1},${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${big} 0 ${p(r0, a0)}Z`
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.): lays values, largest first, into the rectangle. */
export function squarify<T>(items: T[], value: (t: T) => number, box: Rect) {
  const total = sum(items.map(value))
  const k = total > 0 ? (box.w * box.h) / total : 0
  const rest = items
    .map((t) => ({ t, a: value(t) * k }))
    .filter((r) => r.a > 0)
    .sort((a, b) => b.a - a.a)
  const out: (Rect & { t: T })[] = []
  let { x, y, w, h } = box
  while (rest.length) {
    const side = Math.min(w, h)
    let row: typeof rest = []
    let best = Infinity
    while (rest.length) {
      const next = [...row, rest[0]]
      const s = sum(next.map((r) => r.a))
      const worst = Math.max(
        ...next.map((r) =>
          Math.max(
            (side * side * r.a) / (s * s),
            (s * s) / (side * side * r.a),
          ),
        ),
      )
      if (worst > best) break
      best = worst
      row = next
      rest.shift()
    }
    const thick = sum(row.map((r) => r.a)) / side
    let off = 0
    for (const r of row) {
      const len = r.a / thick
      out.push(
        w >= h
          ? { t: r.t, x, y: y + off, w: thick, h: len }
          : { t: r.t, x: x + off, y, w: len, h: thick },
      )
      off += len
    }
    if (w >= h) {
      x += thick
      w -= thick
    } else {
      y += thick
      h -= thick
    }
  }
  return out
}

export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mean-legend">
      {items.map(([label, c]) => (
        <span key={label}>
          <i style={{ background: c }} />
          {label}
        </span>
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
