/**
 * Shared bits for the jobs posts: dataset paths, number formats, a KPI tile, an svg surface,
 * x labels, line paths and ranked bars. Exports no posts of its own.
 */
import { useContext, type ReactNode } from 'react'
import RankBars, { type RankRow } from '../../charts/RankBars'
import { xTickY } from '../axes'
import { OTHER, PostOpen, type Post } from '../kit'
import { FIELD_EN, type Market } from '../../jobs/market'
import { l } from '../../i18n'
import { fixed } from '../../format'
import './job.css'

export const posts: Post[] = []
export type { Market, RankRow }

export const D = 'jobs'
export const MARKET = 'jobs/market.json'
/** A county with a name: ads without one sit under 'Okänt län' ('unknown county'). */
export const knownRegion = (r: { region: string }) =>
  r.region !== 'unknown' && !r.region.startsWith('Okänt')
export const CLUSTERS = 'jobs/cluster-summary.json'
export const PREVIEW = 'jobs/cluster-preview.json'

/** An occupation field in the reader's language: the data names it in Swedish. */
export const fieldName = (sv: string) => l(FIELD_EN[sv] ?? sv, sv)
/** Cluster labels the run writes in English words; skill names like 'Python / SQL' read the
 * same in both languages. */
const CLUSTER_SV: Record<string, string> = {
  'Mixed tech advertisements': 'Blandade techannonser',
  'Unassigned / noise': 'Ej tilldelade / brus',
}
export const clusterLabel = (s: string) => l(s, CLUSTER_SV[s] ?? s)
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const fmt = (n: number) =>
  Math.round(n).toLocaleString(l('en-GB', 'sv-SE'))
export const pct = (n: number, d = 0) => `${fixed(n * 100, d)} %`
export const compact = (n: number) =>
  new Intl.NumberFormat(l('en-GB', 'sv-SE'), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

/** The largest of a list that may be empty: `empty` then, so no −Infinity reaches a scale. */
export const maxOf = (xs: number[], empty = 0) =>
  xs.length ? Math.max(...xs) : empty
export const minOf = (xs: number[], empty = 0) =>
  xs.length ? Math.min(...xs) : empty
/** The values of a list that are present: null and NaN are missing data, never zero. */
export const present = <T,>(xs: (T | null | undefined)[]) =>
  xs.filter((x): x is T => x != null && !Number.isNaN(x))

/** b / a − 1, or null when there is no earlier value to compare with. */
export const ratio = (now: number | undefined, before: number | undefined) =>
  now != null && before ? now / before - 1 : null

/**
 * The latest full calendar year in market.json: the latest year when its months run to
 * December, otherwise the year before.
 */
export const fullYear = (m: Market) =>
  m.last_month.endsWith('-12') ? m.latest_year : m.latest_year - 1

/** 'January–September' ('januari–september'): the months the latest year covers, which every
 * year is counted over. */
export const span = (m: Market) =>
  `${l('January', 'januari')}–${new Date(2000, m.ytd_months - 1, 15).toLocaleString(l('en-GB', 'sv-SE'), { month: 'long' })}`

/** A giant single number with its unit, plain on the card like the other families' KPIs. */
export function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="mean-job-big">
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

/** Labels along the bottom at given x positions, spaced like axes.tsx XAxis. */
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
        <text key={t.label + t.x} x={t.x} {...xTickY(y)} textAnchor="middle">
          {t.label}
        </text>
      ))}
    </g>
  )
}

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
    <div className="mean-bars">
      <RankBars
        rows={open ? rows : (thumb ?? rows.slice(0, n))}
        format={format}
        label={label}
        max={Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)))}
      />
    </div>
  )
}

/** A line through points; a null point is missing data and breaks the line. */
export const linePath = (pts: ([number, number] | null)[]) =>
  pts
    .map((p, i) =>
      p
        ? `${i && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
        : '',
    )
    .join('')
