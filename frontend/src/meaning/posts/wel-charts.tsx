/**
 * Two charts the wel-* posts share: a labelled scatter, and counties ranked by one measure
 * of welfare/panel-county-year.json. Each post loads its own data and passes the rows in.
 */
import { useState } from 'react'
import { XAxis, YAxis } from '../axes'
import { OTHER, Slicer } from '../kit'
import { Ranked, Svg, axis, maxOf, num } from './wel-kit'

export type Dot = { key: string; name: string; x: number; y: number }

/** Pearson's r of the dots' x and y; null with fewer than three dots or no spread. */
export function pearson(p: Dot[]): number | null {
  const n = p.length
  if (n < 3) return null
  const mx = p.reduce((s, q) => s + q.x, 0) / n
  const my = p.reduce((s, q) => s + q.y, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const q of p) {
    sxy += (q.x - mx) * (q.y - my)
    sxx += (q.x - mx) ** 2
    syy += (q.y - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

/**
 * A scatter of grey dots on two value axes, with the extremes named: the lowest and highest
 * x and the highest y. `all` fixes the axes across slicer steps.
 */
export function Scatter({
  dots,
  all = dots,
  label,
  xFormat,
  yFormat,
  zeroY = true,
  r = 3.5,
}: {
  dots: Dot[]
  all?: Dot[]
  label: string
  xFormat: (v: number) => string
  yFormat: (v: number) => string
  zeroY?: boolean
  r?: number
}) {
  const ax = axis(
    all.map((p) => p.x),
    [36, 290],
    false,
  )
  const ay = axis(
    all.map((p) => p.y),
    [176, 14],
    zeroY,
  )
  const by = (f: (p: Dot) => number) => [...dots].sort((a, b) => f(a) - f(b))
  const named = new Set(
    dots.length > 30
      ? []
      : [by((p) => p.x)[0], by((p) => p.x).at(-1), by((p) => p.y).at(-1)].map(
          (p) => p?.key,
        ),
  )
  return (
    <Svg label={label}>
      <YAxis y={ay.y} ticks={ay.ticks} x0={36} x1={290} format={yFormat} />
      <XAxis
        x={ax.y}
        y={192}
        ticks={ax.ticks.map((v) => ({ value: v, label: xFormat(v) }))}
      />
      {dots.map((p) => {
        const cx = ax.y(p.x)
        const right = cx > 220
        return (
          <g key={p.key}>
            <circle cx={cx} cy={ay.y(p.y)} r={r} fill={OTHER} opacity={0.85}>
              <title>{`${p.name}: ${xFormat(p.x)}, ${yFormat(p.y)}`}</title>
            </circle>
            {named.has(p.key) && (
              <text
                className="mean-wel-name"
                x={cx + (right ? -6 : 6)}
                y={ay.y(p.y) + 4}
                textAnchor={right ? 'end' : 'start'}
              >
                {p.name}
              </text>
            )}
          </g>
        )
      })}
    </Svg>
  )
}

/** One row of welfare/panel-county-year.json: a county, or Sweden as a whole, in a year. */
export type CountyYear = {
  region_code: string
  region_name: string
  is_country: boolean
  year: number
} & Record<string, unknown>

export type CountyMetric = {
  field: string
  name: string
  format: (v: number) => string
}

export const county = (name: string) => name.replace(/s? län$/, '')

/** The latest year with county values for `key` (null without any), the counties and the
 * national figure. */
export function latestCounties(rows: CountyYear[], key: string) {
  const ok = rows.filter((r) => num(r[key]))
  const year = maxOf(ok.map((r) => r.year))
  const at = ok.filter((r) => r.year === year)
  const nation = at.find((r) => r.is_country)?.[key]
  return {
    year,
    counties: at
      .filter((r) => !r.is_country)
      .map((r) => ({ ...r, value: r[key] as number }))
      .sort((a, b) => b.value - a.value),
    nation: num(nation) ? nation : undefined,
  }
}

/**
 * Counties ranked by one measure in its latest year, a slicer over the measures, and the
 * national figure as a tick on every bar.
 */
export function CountyRank({
  rows,
  metrics,
}: {
  rows: CountyYear[]
  metrics: Record<string, CountyMetric>
}) {
  const names = Object.keys(metrics)
  const [m, setM] = useState(names[0])
  const metric = metrics[m]
  const { year, counties, nation } = latestCounties(rows, metric.field)
  if (year === null) return null
  return (
    <>
      <Slicer
        label="Measure"
        options={names}
        format={(o) => metrics[o].name}
        value={m}
        onChange={setM}
      />
      <Ranked
        label={`Counties ranked by ${metric.name}, ${year}; tick: Sweden as a whole`}
        format={metric.format}
        mark={nation}
        rows={counties.map((r) => ({
          key: r.region_code,
          label: county(r.region_name),
          value: r.value,
        }))}
      />
    </>
  )
}
