import { useMemo, useRef, useState } from 'react'
import { linearScale, niceTicks } from './scales'

/**
 * Categorical series colours, in fixed order and never cycled: a sixth series is not
 * drawn. Validated against the site surface (#f3f1ea) for lightness, chroma, colour-vision
 * separation and 3:1 contrast with the dataviz palette validator.
 */
export const SERIES_COLORS = [
  '#008f82',
  '#e0512e',
  '#7a52b3',
  '#a47400',
  '#1c72c4',
]
export const MAX_SERIES = SERIES_COLORS.length

export type SeriesPoint = {
  /** Period start, ISO date; the x position. */
  date: string
  /** Period label shown in the tooltip ('2024-03', '2021-2024', 'ESS11 (2023-2024)'). */
  label: string
  value: number
  low?: number | null
  high?: number | null
}
export type Series = { key: string; name: string; points: SeriesPoint[] }

type Props = {
  series: Series[]
  label: string
  format: (value: number) => string
  /** Colour index per series key, so a series keeps its colour when others are removed. */
  colorOf: (key: string) => number
}

const WIDTH = 900
const HEIGHT = 340
const MARGIN = { top: 20, right: 24, bottom: 40, left: 64 }
const time = (date: string) => Date.parse(date)

/**
 * Up to five series on a true time axis, with each point's confidence interval as a band
 * where the source publishes one. Hovering shows every series at the nearest period.
 * The y axis starts at zero unless the data are all far from it (survey means on 0-10).
 */
export default function MultiLineChart({
  series,
  label,
  format,
  colorOf,
}: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const plotW = WIDTH - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom

  const { x, y, ticks, years, dates } = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    const values = all.flatMap((p) => [
      p.value,
      p.low ?? p.value,
      p.high ?? p.value,
    ])
    const max = Math.max(...values)
    const min = Math.min(...values)
    // Zero baseline unless the series live in a narrow band well above it.
    const from = min > 0 && min > max * 0.6 ? Math.floor(min) : 0
    const ticks = niceTicks(max - from).map((tick) => tick + from)
    const times = all.map((p) => time(p.date))
    const t0 = Math.min(...times)
    const t1 = Math.max(...times)
    const x = linearScale(
      [t0, t1 === t0 ? t0 + 1 : t1],
      [MARGIN.left, MARGIN.left + plotW],
    )
    const y = linearScale(
      [from, ticks.at(-1)!],
      [MARGIN.top + plotH, MARGIN.top],
    )
    const firstYear = new Date(t0).getUTCFullYear()
    const lastYear = new Date(t1).getUTCFullYear()
    const step = Math.max(1, Math.ceil((lastYear - firstYear + 1) / 10))
    const years: number[] = []
    for (let year = firstYear; year <= lastYear; year += step) years.push(year)
    const dates = [...new Set(all.map((p) => p.date))].sort()
    return { x, y, ticks, years, dates }
  }, [series, plotW, plotH])

  if (!series.length || !dates.length) return null

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const px = ((event.clientX - box.left) / box.width) * WIDTH
    let nearest = 0
    dates.forEach((date, index) => {
      if (Math.abs(x(time(date)) - px) < Math.abs(x(time(dates[nearest])) - px))
        nearest = index
    })
    setHover(nearest)
  }
  const hoverDate = hover === null ? null : dates[hover]
  const hoverX = hoverDate ? x(time(hoverDate)) : 0

  return (
    <figure className="multi-chart">
      <ul className="chart-legend" aria-label="Series">
        {series.map((s) => (
          <li key={s.key}>
            <span
              className="legend-swatch"
              style={{ background: SERIES_COLORS[colorOf(s.key)] }}
            />
            {s.name}
          </li>
        ))}
      </ul>
      <div className="chart-wrap">
        <svg
          ref={svg}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="grid-line"
              />
              <text
                x={MARGIN.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="axis-label"
              >
                {format(tick)}
              </text>
            </g>
          ))}
          {years.map((year) => (
            <text
              key={year}
              x={x(Date.UTC(year, 0, 1))}
              y={HEIGHT - 12}
              textAnchor="middle"
              className="axis-label"
            >
              {year}
            </text>
          ))}
          {series.map((s) => {
            const color = SERIES_COLORS[colorOf(s.key)]
            const banded = s.points.filter(
              (p) => p.low != null && p.high != null,
            )
            const band =
              banded.length > 1
                ? banded
                    .map((p) => `${x(time(p.date))},${y(p.high!)}`)
                    .join(' ') +
                  ' ' +
                  [...banded]
                    .reverse()
                    .map((p) => `${x(time(p.date))},${y(p.low!)}`)
                    .join(' ')
                : null
            return (
              <g key={s.key}>
                {band && <polygon points={band} fill={color} opacity={0.12} />}
                <polyline
                  points={s.points
                    .map((p) => `${x(time(p.date))},${y(p.value)}`)
                    .join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {s.points.length < 40 &&
                  s.points.map((p) => (
                    <circle
                      key={p.date}
                      cx={x(time(p.date))}
                      cy={y(p.value)}
                      r={4}
                      fill={color}
                      stroke="#fbfaf6"
                      strokeWidth={2}
                    />
                  ))}
              </g>
            )
          })}
          {hoverDate && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={MARGIN.top}
              y2={MARGIN.top + plotH}
              className="crosshair"
            />
          )}
        </svg>
        {hoverDate && (
          <div
            className="chart-tooltip"
            // Anchored left of the crosshair in the right third, so it never overflows.
            style={
              hoverX > WIDTH * 0.66
                ? { right: `${100 - (hoverX / WIDTH) * 100}%` }
                : { left: `${(hoverX / WIDTH) * 100}%` }
            }
            data-side={hoverX > WIDTH * 0.66 ? 'left' : 'right'}
            role="status"
          >
            {series.map((s) => {
              const point = s.points.find((p) => p.date === hoverDate)
              return point ? (
                <div key={s.key}>
                  <span
                    className="legend-swatch"
                    style={{ background: SERIES_COLORS[colorOf(s.key)] }}
                  />
                  <strong>{format(point.value)}</strong> {s.name}
                  <small> · {point.label}</small>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
    </figure>
  )
}
