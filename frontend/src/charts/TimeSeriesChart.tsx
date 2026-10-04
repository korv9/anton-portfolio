import { l } from '../i18n'
import { linearScale, niceTicks, yearTicks } from './scales'

export type TimePoint = { date: string; value: number }

type Props = {
  points: TimePoint[]
  /** Accessible name of the whole chart. */
  label: string
  /** Text for one point's tooltip, e.g. '2024-03: 412 ads'. */
  describe: (point: TimePoint) => string
  formatTick?: (value: number) => string
  /** Hint for the horizontal-scroll wrapper on small screens. */
  scrollHint?: string
  color?: string
}

const WIDTH = 900
const HEIGHT = 330
const MARGIN = { top: 24, right: 24, bottom: 44, left: 62 }

/**
 * A chronological series on a true time axis. The y axis includes zero and negative
 * observations; missing months keep their calendar spacing. The x axis marks each calendar
 * year present in the data.
 */
export default function TimeSeriesChart({
  points,
  label,
  describe,
  formatTick = String,
  scrollHint,
  color = '#4e79a7',
}: Props) {
  points = points
    .filter(
      (point) =>
        Number.isFinite(point.value) && Number.isFinite(Date.parse(point.date)),
    )
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  if (!points.length)
    return (
      <p>
        {l(
          'No observations for this selection.',
          'Inga observationer för detta urval.',
        )}
      </p>
    )
  const plotW = WIDTH - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const minimum = Math.min(0, ...points.map((point) => point.value))
  const ticks = niceTicks(
    Math.max(0, ...points.map((point) => point.value)) - minimum,
  ).map((tick) => tick + minimum)
  const yMax = ticks.at(-1) ?? 1
  const x = linearScale(
    [
      Date.parse(points[0].date),
      Math.max(Date.parse(points[0].date) + 1, Date.parse(points.at(-1)!.date)),
    ],
    [MARGIN.left, MARGIN.left + plotW],
  )
  const y = linearScale([minimum, yMax], [MARGIN.top + plotH, MARGIN.top])
  const years = yearTicks(points.map((point) => point.date))
  const path = points
    .map((point) => `${x(Date.parse(point.date))},${y(point.value)}`)
    .join(' ')
  return (
    <div className="chart-wrap" tabIndex={0} aria-label={scrollHint}>
      <svg
        className="line-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
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
              x={MARGIN.left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              className="axis-label"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {years.map((tick, index) => (
          <text
            key={tick.label}
            x={x(Date.parse(points[tick.index].date))}
            y={HEIGHT - 12}
            textAnchor={
              index === 0 && tick.index === 0
                ? 'start'
                : tick.index === points.length - 1
                  ? 'end'
                  : 'middle'
            }
            className="axis-label"
          >
            {tick.label}
          </text>
        ))}
        <polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point) => (
          <circle
            key={point.date}
            cx={x(Date.parse(point.date))}
            cy={y(point.value)}
            r="4"
            tabIndex={0}
            aria-label={describe(point)}
            fill={color}
            className="line-point"
          >
            <title>{describe(point)}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
