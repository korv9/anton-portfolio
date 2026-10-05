import { l } from '../i18n'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { linearScale, niceTicks } from './scales'
import { identity, partyDash } from '../parties/identity'
import { MarkerShape, spreadLabels } from './marks'

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
export type Series = {
  key: string
  name: string
  points: SeriesPoint[]
  /** A party code: the line then takes the party's marker, line style and an end label. */
  party?: string
}

type Props = {
  series: Series[]
  label: string
  format: (value: number) => string
  /** Colour index per series key, so a series keeps its colour when others are removed; or
   * the colour itself, for series with their own (a party's colour). */
  colorOf: (key: string) => number | string
  /** Fixed bottom of the y axis, for measures whose floor is not zero (AUC: 0.5). */
  yFrom?: number
}

const BASE_MARGIN = { top: 20, right: 24, bottom: 40, left: 64 }
const time = (date: string) => Date.parse(date)

/**
 * Up to five series on a true time axis, with each point's confidence interval as a band
 * where the source publishes one. Hovering shows every series at the nearest period.
 * The y axis includes zero and negative values unless the caller explicitly supplies a floor.
 */
export default function MultiLineChart({
  series,
  label,
  format,
  colorOf,
  yFrom,
}: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const container = useRef<HTMLElement>(null)
  const hintId = useId()
  const [width, setWidth] = useState(900)
  const hasPoints = series.some((item) => item.points.length > 0)
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, Math.min(1100, entry.contentRect.width))),
    )
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [hasPoints])
  const WIDTH = width
  const HEIGHT = width < 540 ? 300 : 360
  const paint = (key: string) => {
    const color = colorOf(key)
    return typeof color === 'string' ? color : SERIES_COLORS[color]
  }
  const [hover, setHover] = useState<number | null>(null)
  // Party lines are labelled at their end, so the plot leaves room on the right.
  const labelled = series.some((s) => s.party)
  const MARGIN = labelled ? { ...BASE_MARGIN, right: 56 } : BASE_MARGIN
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
    // Keep a consistent baseline across filters; include negative observations.
    const from = yFrom ?? Math.min(0, Math.floor(min))
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
    const step = Math.max(
      1,
      Math.ceil((lastYear - firstYear + 1) / (width < 540 ? 4 : 8)),
    )
    const years: number[] = []
    for (let year = firstYear; year <= lastYear; year += step) {
      if (Date.UTC(year, 0, 1) >= t0) years.push(year)
    }
    const dates = [...new Set(all.map((p) => p.date))].sort()
    return { x, y, ticks, years, dates }
  }, [series, plotW, plotH, yFrom, MARGIN.left, MARGIN.top, width])

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
  const hoverDate =
    hover === null ? null : dates[Math.min(hover, dates.length - 1)]
  const hoverX = hoverDate ? x(time(hoverDate)) : 0

  return (
    <figure className="multi-chart" ref={container}>
      <ul className="chart-legend" aria-label={l('Series', 'Serier')}>
        {series.map((s) => (
          <li key={s.key}>
            {s.party ? (
              <svg
                className="legend-line"
                width="28"
                height="12"
                aria-hidden="true"
              >
                <line
                  x1="1"
                  x2="27"
                  y1="6"
                  y2="6"
                  stroke={paint(s.key)}
                  strokeWidth="2"
                  strokeDasharray={partyDash(s.party)}
                />
                <MarkerShape
                  shape={identity(s.party).marker}
                  x={14}
                  y={6}
                  size={3.5}
                  fill={paint(s.key)}
                />
              </svg>
            ) : (
              <span
                className="legend-swatch"
                style={{ background: paint(s.key) }}
              />
            )}
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
          aria-describedby={hintId}
          tabIndex={0}
          onFocus={() => setHover(dates.length - 1)}
          onKeyDown={(event) => {
            if (
              !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(
                event.key,
              )
            )
              return
            event.preventDefault()
            if (event.key === 'Escape') setHover(null)
            else if (event.key === 'Home') setHover(0)
            else if (event.key === 'End') setHover(dates.length - 1)
            else
              setHover((current) =>
                Math.max(
                  0,
                  Math.min(
                    dates.length - 1,
                    (current ?? dates.length - 1) +
                      (event.key === 'ArrowLeft' ? -1 : 1),
                  ),
                ),
              )
          }}
          onPointerDown={onMove}
          onPointerMove={onMove}
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
            const color = paint(s.key)
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
            const line = s.points
              .map((p) => `${x(time(p.date))},${y(p.value)}`)
              .join(' ')
            return (
              <g key={s.key}>
                {band && <polygon points={band} fill={color} opacity={0.12} />}
                {s.party && identity(s.party).casing && (
                  <polyline
                    className="casing"
                    points={line}
                    fill="none"
                    stroke={identity(s.party).casing}
                    strokeWidth={4}
                    strokeLinejoin="round"
                    strokeDasharray={partyDash(s.party)}
                  />
                )}
                <polyline
                  points={line}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeDasharray={s.party ? partyDash(s.party) : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {s.points.length < 40 &&
                  s.points.map((p) =>
                    s.party ? (
                      <MarkerShape
                        key={p.date}
                        shape={identity(s.party).marker}
                        x={x(time(p.date))}
                        y={y(p.value)}
                        size={3.5}
                        fill={color}
                        stroke={identity(s.party).casing ?? 'var(--page)'}
                      />
                    ) : (
                      <circle
                        className="round"
                        key={p.date}
                        cx={x(time(p.date))}
                        cy={y(p.value)}
                        r={4}
                        fill={color}
                        stroke="var(--page)"
                        strokeWidth={2}
                      />
                    ),
                  )}
              </g>
            )
          })}
          {labelled &&
            spreadLabels(
              series
                .filter((s) => s.party && s.points.length)
                .map((s) => {
                  const last = s.points.at(-1)!
                  return {
                    key: s.key,
                    party: s.party!,
                    x: x(time(last.date)),
                    y: y(last.value),
                  }
                }),
              14,
              MARGIN.top + 6,
              MARGIN.top + plotH,
            ).map((label) => (
              <g key={`label-${label.key}`} className="end-label">
                <MarkerShape
                  shape={identity(label.party).marker}
                  x={label.x}
                  y={label.y}
                  size={4}
                  fill={paint(label.key)}
                  stroke={identity(label.party).casing ?? 'var(--page)'}
                />
                <text
                  x={label.x + 10}
                  y={label.labelY + 4}
                  className="end-label-text"
                >
                  {label.party}
                </text>
              </g>
            ))}
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
          <div className="chart-tooltip" role="status">
            {series.map((s) => {
              const point = s.points.find((p) => p.date === hoverDate)
              return point ? (
                <div key={s.key}>
                  <span
                    className="legend-swatch"
                    style={{ background: paint(s.key) }}
                  />
                  <strong>{format(point.value)}</strong> {s.name}
                  <small> · {point.label}</small>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
      <figcaption className="chart-guidance" id={hintId}>
        {l(
          'Point to or tap a period for exact values. Use the arrow keys when the chart is focused.',
          'Peka eller tryck på en tidpunkt för exakta värden. Använd piltangenterna när grafen är markerad.',
        )}
      </figcaption>
    </figure>
  )
}
