/**
 * Small parts shared by the wel-* posts: extents, paths, a value axis, ranked bars, a legend
 * and a labelled number. Exports no posts of its own. Chart sizes follow the card: a square
 * card's chart area is about 300 by 200 px, a wide one about 600 by 220, so one SVG unit is
 * about one pixel and the card's text compensation stays near 1. The scatter and the county
 * ranking live in wel-charts.tsx.
 */
import { useContext, type ReactNode } from 'react'
import RankBars from '../../charts/RankBars'
import { linearScale, niceStep } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { PostOpen, focal, type Post } from '../kit'
import { l } from '../../i18n'
import { fixed } from '../../format'
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
  if (a >= 1e6) return `${fixed(v / 1e6, digits)}${l('M', ' mn')}`
  if (a >= 1e4) return `${fixed(v / 1e3)}${l('k', ' tn')}`
  return v.toLocaleString(l('en-GB', 'sv-SE'), {
    maximumFractionDigits: digits,
  })
}

/** '2026-08' -> 'Aug 2026'; a year stays as it is. */
export const month = (label: string) =>
  /^\d{4}-\d{2}$/.test(label)
    ? new Date(`${label}-01T00:00:00Z`).toLocaleDateString(
        l('en-GB', 'sv-SE'),
        {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        },
      )
    : label

/** Whole kronor with Swedish digit grouping, e.g. '14 108'. */
export const sek = (v: number) => Math.round(v).toLocaleString('sv-SE')

export const pct = (v: number, digits = 1) => `${fmt(v, digits)}${l('%', ' %')}`

/** 1 -> '1st' ('1:a'), 2 -> '2nd' ('2:a'), 11 -> '11th' ('11:e'). */
export const ordinal = (n: number) =>
  l(
    `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`,
    `${n}:${[1, 2].includes(n % 10) && ![11, 12].includes(n % 100) ? 'a' : 'e'}`,
  )

/** The largest value, or null for an empty list (Math.max would give -Infinity). */
export const maxOf = (v: number[]) => (v.length ? Math.max(...v) : null)

export function groupBy<T, K>(rows: T[], key: (r: T) => K) {
  const out = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(r)
  }
  return out
}

/**
 * A value scale onto `range` (bottom, top) with its ticks: the domain is widened to whole
 * nice steps, from zero unless `zero` is false, and the ticks use the same step, so the top
 * and bottom gridlines are the domain's ends.
 */
export function axis(values: number[], range: [number, number], zero = true) {
  const [a, b] = extent(values)
  const lo = zero ? Math.min(0, a) : a
  const step = niceStep(b - lo, 4)
  const domain = niceDomain(lo, b)
  return {
    y: scale(domain, range),
    domain,
    ticks: ticksBetween(domain[0], domain[1], 4, step),
  }
}

export function Svg({
  w = 300,
  h = 200,
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

/** A key for the opened post; each swatch takes the colour its marks are drawn in. */
export function Legend({
  items,
  colors,
}: {
  items: string[]
  colors: string[]
}) {
  return (
    <div className="mean-legend">
      {items.map((t, i) => (
        <span key={t}>
          <i style={{ background: colors[i] }} />
          {t}
        </span>
      ))}
    </div>
  )
}

export type RankedRow = { key: string; label: string; value: number }

/**
 * Categories as sorted horizontal bars (charts/RankBars), the value written at the end. One
 * bar takes the accent: `focus`, or else the largest. `mark` draws the same tick on every
 * track, e.g. the national figure. A thumbnail with more rows than fit shows the `head`
 * highest, the `tail` lowest and the focus row, with a dashed rule where rows are left out
 * and a count of the rest; opened, the post lists them all.
 */
export function Ranked({
  rows,
  format,
  label,
  max,
  focus,
  mark,
  wrap,
  head = 4,
  tail = 4,
}: {
  rows: RankedRow[]
  format: (v: number) => string
  label: string
  max?: number
  focus?: string
  mark?: number
  /** Long labels wrap onto a second line instead of being cut. */
  wrap?: boolean
  head?: number
  tail?: number
}) {
  const open = useContext(PostOpen)
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  const hot = focus ?? sorted[0]?.key
  const keep = (r: RankedRow, i: number) =>
    open ||
    sorted.length <= head + tail ||
    i < head ||
    i >= sorted.length - tail ||
    r.key === hot
  const shown = sorted
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => keep(r, i))
  const hidden = sorted.length - shown.length
  return (
    <div
      className={`mean-bars mean-wel-rank${wrap ? ' mean-wel-wrap' : ''}`}
      data-hidden={hidden}
    >
      <RankBars
        label={label}
        format={format}
        max={max}
        rows={shown.map(({ r, i }, j) => ({
          key: r.key,
          label:
            j && shown[j - 1].i !== i - 1 ? (
              <>
                <i className="mean-wel-gap" aria-hidden="true" />
                {r.label}
              </>
            ) : (
              r.label
            ),
          value: r.value,
          color: focal(r.key === hot),
          ref: mark,
        }))}
      />
    </div>
  )
}

/** A number with its unit, what it measures, and the change since the period before. */
export function Kpi({
  value,
  unit,
  label,
  delta,
  since,
}: {
  value: string
  unit?: string
  label?: string
  /** Already formatted with its sign and unit, e.g. '+0.3 points'. */
  delta?: string
  since?: string
}) {
  return (
    <div className="mean-wel-kpi">
      <b>
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
      {label ? <span>{label}</span> : null}
      {delta ? (
        <em>
          {delta}
          {since ? l(` from ${since}`, ` sedan ${since}`) : ''}
        </em>
      ) : null}
    </div>
  )
}

/** A signed change, e.g. +0.3 or −1.2, with its unit. */
export const signed = (v: number, unit = '', digits = 1) =>
  `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), digits)}${unit}`
