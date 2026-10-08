/**
 * Column charts. One category axis (years, months, parties, debates), one value axis from zero.
 * Several series stand side by side in each category (grouped), or on top of each other
 * (stacked) when they add up to a whole. Negative values hang below the zero line. A party
 * series takes the party's colour; anything else is one neutral hue. Every column has a hit
 * target the height of the plot and a tooltip with its value.
 *
 * ColumnMultiples draws one small chart per series on a shared scale, the columns version of
 * several lines over time, so no one has to tell overlapping lines apart.
 */
import type { KeyboardEvent } from 'react'
import { identity, partyName } from '../../parties/identity'
import { useSize } from '../dash/motion'

export type ColumnSeries = {
  key: string
  label: string
  party?: string
  /** The series the chart is about: drawn darkest, the others step back. */
  focus?: boolean
  values: (number | null)[]
}

const NEUTRAL = 'var(--ink-2)'

// Non-party series: one hue in opaque steps, darkest first, so a grid line never shows through.
const SHADES = [
  'var(--ink-2)',
  'var(--subtle)',
  'color-mix(in srgb, var(--ink-2) 38%, var(--page))',
]

function colour(series: ColumnSeries, index: number, all: ColumnSeries[]) {
  if (series.party) return identity(series.party).color
  if (all.length === 1) return NEUTRAL
  const focused = all.findIndex((x) => x.focus)
  if (focused < 0) return SHADES[Math.min(index, SHADES.length - 1)]
  if (index === focused) return SHADES[0]
  // The others keep their order behind the focused one.
  return SHADES[
    Math.min(index < focused ? index + 1 : index, SHADES.length - 1)
  ]
}

function niceTop(value: number) {
  if (value <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(value))
  const top = Math.ceil(value / step) * step
  return top / 2 >= value ? top / 2 : top
}

export default function Columns({
  categories,
  series,
  format,
  label,
  height = 220,
  stacked = false,
  highlight,
  onPick,
  domain,
}: {
  categories: string[]
  series: ColumnSeries[]
  format: (v: number) => string
  label: string
  height?: number
  stacked?: boolean
  /** Index of a category drawn with an outline (e.g. the chosen year). */
  highlight?: number
  /** Called with a category index when its column is clicked. */
  onPick?: (index: number) => void
  /** A fixed value range, so small multiples share one scale. */
  domain?: [number, number]
}) {
  const [ref, size] = useSize<HTMLDivElement>()
  const width = Math.max(size.width, 160)
  const pad = { top: 10, right: 6, bottom: 30, left: 50 }
  const totals = categories.map((_, i) =>
    stacked
      ? [
          series.reduce((s, x) => s + Math.min(0, x.values[i] ?? 0), 0),
          series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0),
        ]
      : [
          Math.min(0, ...series.map((x) => x.values[i] ?? 0)),
          Math.max(0, ...series.map((x) => x.values[i] ?? 0)),
        ],
  )
  const least = Math.min(0, ...totals.map((t) => t[0]))
  const low = domain ? domain[0] : least < 0 ? -niceTop(-least) : 0
  const high = domain
    ? domain[1]
    : niceTop(Math.max(0, ...totals.map((t) => t[1])))
  const lo = Math.min(0, low)
  const hi = high <= lo ? lo + 1 : high
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const y = (v: number) => pad.top + ((hi - v) / (hi - lo)) * plotH
  const band = plotW / Math.max(1, categories.length)
  const groupGap = band > 14 ? Math.min(8, band * 0.18) : 1
  const inner = band - groupGap
  const colW = stacked ? inner : inner / Math.max(1, series.length)
  // Ticks at the ends and zero; one too close to zero to label apart from it is left out.
  const ticks = (lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi]).filter(
    (t) => t === 0 || Math.abs(y(t) - y(0)) >= 14,
  )
  // Label every nth category so labels never collide.
  const room = Math.max(
    22,
    Math.max(...categories.map((c) => c.length)) * 7 + 10,
  )
  const every = Math.max(
    1,
    Math.ceil(categories.length / Math.max(1, plotW / room)),
  )
  // Series that are not parties need a key: their shades carry no meaning of their own.
  const legend = series.length > 1 && !series.some((x) => x.party)
  return (
    <>
      {legend && (
        <ul className="board-legend">
          {series.map((x, j) => (
            <li key={x.key}>
              <i
                style={{ background: colour(x, j, series) }}
                aria-hidden="true"
              />
              {x.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="columns" style={{ height }}>
        {size.width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? 'columns-zero' : 'columns-grid'}
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="columns-axis"
                  x={pad.left - 6}
                  y={y(t) + 4}
                  textAnchor="end"
                >
                  {format(t)}
                </text>
              </g>
            ))}
            {categories.map((category, i) => {
              const x0 = pad.left + i * band + groupGap / 2
              let up = 0
              let down = 0
              const title = `${category}\n${series
                .map(
                  (s) =>
                    `${s.party ? partyName(s.party) : s.label}: ${s.values[i] == null ? '–' : format(s.values[i]!)}`,
                )
                .join('\n')}`
              return (
                <g
                  key={category + i}
                  className={onPick ? 'columns-cat pickable' : 'columns-cat'}
                  onClick={onPick ? () => onPick(i) : undefined}
                  {...(onPick && {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': title.replace(/\n/g, ', '),
                    onKeyDown: (e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPick(i)
                      }
                    },
                  })}
                >
                  <title>{title}</title>
                  <rect
                    className="columns-hit"
                    x={pad.left + i * band}
                    y={pad.top}
                    width={band}
                    height={plotH}
                  />
                  {highlight === i && (
                    <rect
                      className="columns-highlight"
                      x={pad.left + i * band + 1}
                      y={pad.top}
                      width={band - 2}
                      height={plotH}
                    />
                  )}
                  {series.map((s, j) => {
                    const v = s.values[i]
                    if (v == null || v === 0) return null
                    let top: number
                    let bottom: number
                    if (stacked) {
                      if (v > 0) {
                        top = y(up + v)
                        bottom = y(up)
                        up += v
                      } else {
                        top = y(down)
                        bottom = y(down + v)
                        down += v
                      }
                    } else {
                      top = y(Math.max(0, v))
                      bottom = y(Math.min(0, v))
                    }
                    const p = s.party ? identity(s.party) : null
                    return (
                      <rect
                        key={s.key}
                        className="columns-bar"
                        x={stacked ? x0 : x0 + j * colW}
                        y={top}
                        width={Math.max(
                          1,
                          (stacked ? inner : colW) - (colW > 5 ? 1 : 0),
                        )}
                        height={Math.max(1, bottom - top)}
                        stroke={p?.casing ?? undefined}
                        style={{
                          ['--i' as string]: i,
                          fill: colour(s, j, series),
                        }}
                      />
                    )
                  })}
                  {i % every === 0 && (
                    <text
                      className="columns-axis"
                      x={pad.left + i * band + band / 2}
                      y={height - pad.bottom + 16}
                      textAnchor="middle"
                    >
                      {category}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </>
  )
}

/** One small column chart per series, on a shared scale. */
export function ColumnMultiples({
  categories,
  series,
  format,
  label,
  height = 120,
}: {
  categories: string[]
  series: ColumnSeries[]
  format: (v: number) => string
  label: string
  height?: number
}) {
  const all = series.flatMap((s) => s.values.map((v) => v ?? 0))
  const hi = niceTop(Math.max(0, ...all))
  const least = Math.min(0, ...all)
  const lo = least < 0 ? -niceTop(-least) : 0
  return (
    <ol className="column-multiples" aria-label={label}>
      {series.map((s) => (
        <li key={s.key}>
          <p>
            {s.party && (
              <i
                style={{ background: identity(s.party).color }}
                aria-hidden="true"
              />
            )}
            {s.label}
          </p>
          <Columns
            categories={categories}
            series={[s]}
            format={format}
            label={`${label}: ${s.label}`}
            height={height}
            domain={[Math.min(0, lo), hi]}
          />
        </li>
      ))}
    </ol>
  )
}

/** Series of dated points (the shape line charts take) as small column charts. */
export function SeriesColumns({
  series,
  format,
  label,
  tick = (date) => date.slice(0, 4),
}: {
  series: {
    key: string
    name: string
    party?: string
    points: { date: string; value: number }[]
  }[]
  format: (v: number) => string
  label: string
  /** The category label for a date; the year by default. */
  tick?: (date: string) => string
}) {
  const dates = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p.date))),
  ].sort()
  return (
    <ColumnMultiples
      categories={dates.map(tick)}
      series={series.map((s) => ({
        key: s.key,
        label: s.name,
        party: s.party,
        values: dates.map(
          (d) => s.points.find((p) => p.date === d)?.value ?? null,
        ),
      }))}
      format={format}
      label={label}
    />
  )
}
