/**
 * Shared bits for the politics posts: party colours, list helpers, number formats, card-sized
 * ranked bars and 100 % rows, and government spans. Exports no posts of its own.
 */
import type { ComponentProps, ReactNode } from 'react'
import RankBars from '../../charts/RankBars'
import { Stacked } from '../../charts/Compare'
import type { Post } from '../kit'
import './pol.css'

export const posts: Post[] = []

/** Left to right on the usual bloc axis. */
export const PARTIES = ['V', 'S', 'MP', 'C', 'L', 'KD', 'M', 'SD'] as const
export const isParty = (p: string) => PARTIES.includes(p as never)

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
/** The item with the highest score; undefined for an empty list. */
export const best = <T,>(xs: T[], score: (x: T) => number) =>
  xs.reduce<T | undefined>(
    (a, b) => (a === undefined || score(b) > score(a) ? b : a),
    undefined,
  )
/** The first of the last n items, or the first item when there are fewer. */
export const fromEnd = <T,>(xs: T[], n: number) => xs.slice(-n)[0]

/** Polyline path through points, skipping nothing. */
export const line = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')

/** Closed area between an upper and a lower line. */
export const band = (top: [number, number][], bottom: [number, number][]) =>
  `${line(top)}${line([...bottom].reverse()).replace('M', 'L')}Z`

/** Every nth item, for tick thinning. */
export const every = <T,>(xs: T[], n: number) =>
  xs.filter((_, i) => i % n === 0)

/** Per cent, at most `digits` decimals, with a space before the sign. */
export const pct = (v: number, digits = 1) => `${Number(v.toFixed(digits))} %`
/** Whole numbers with a space between thousands, e.g. 1 071. */
export const int = (v: number) => Math.round(v).toLocaleString('sv-SE')
/** A change with its sign: +1.7, −3.0, 0.0. */
export const signed = (v: number, digits = 1) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`

/** charts/RankBars at card size (meaning.css .mean-bars). */
export const Bars = (props: ComponentProps<typeof RankBars>) => (
  <div className="mean-bars">
    <RankBars {...props} />
  </div>
)

/** charts/Compare Stacked at card size, parts named once above the rows. */
export const Shares = (props: ComponentProps<typeof Stacked>) => (
  <div className="mean-bars">
    <Stacked {...props} />
  </div>
)

/** The option a categorical slicer holds, named above the chart: thumbnails hide the slicer. */
export const Sub = ({ children }: { children: ReactNode }) => (
  <p className="mean-pol-sub">{children}</p>
)

type GovSession = { government_key: string; government_name: string }

/** Runs of sessions under one government, e.g. "Persson" over 1996/97 to 2005/06. */
export function govSpans(sessions: GovSession[]) {
  const out: { name: string; from: number; to: number }[] = []
  sessions.forEach((s, i) => {
    const last = out.at(-1)
    if (last && sessions[last.from].government_key === s.government_key)
      last.to = i
    else
      out.push({
        name: s.government_name.replace(/^Regeringen /, ''),
        from: i,
        to: i,
      })
  })
  return out
}

/** Grey bands under a session axis, one per government, named where the band has room. The
 * sessions must be the same list, in the same order, that `x` places. */
export function GovStrip({
  sessions,
  x,
  step,
  y,
}: {
  sessions: GovSession[]
  x: (i: number) => number
  step: number
  y: number
}) {
  return (
    <g className="mean-axis">
      {govSpans(sessions).map((g, k) => {
        const x0 = x(g.from) - step / 2
        const w = (g.to - g.from + 1) * step
        return (
          <g key={g.from}>
            <rect
              x={x0 + 0.5}
              y={y}
              width={w - 1}
              height={14}
              fill={shadeOf(k)}
            >
              <title>{g.name}</title>
            </rect>
            {w > g.name.length * 5.6 + 6 && (
              <text x={x0 + w / 2} y={y + 10.5} textAnchor="middle">
                {g.name}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
const shadeOf = (k: number) =>
  `color-mix(in srgb, var(--mean-other) ${k % 2 ? 14 : 26}%, var(--paper))`
