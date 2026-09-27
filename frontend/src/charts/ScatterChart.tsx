import { useEffect, useMemo, useRef, useState } from 'react'
import { linearScale, niceStep } from './scales'
import { SERIES_COLORS } from './MultiLineChart'

export type ScatterPoint = {
  key: string
  label: string
  x: number
  y: number
  /** Drawn in the second series colour and labelled directly, e.g. the national value. */
  reference?: boolean
}

type Props = {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  formatX: (value: number) => string
  formatY: (value: number) => string
  label: string
}

const MARGIN = { top: 20, right: 28, bottom: 56, left: 72 }

/** Ticks covering [min, max] on nice steps, not forced to zero: both axes are levels. */
function rangeTicks(min: number, max: number) {
  const step = niceStep(max - min || Math.abs(max) || 1, 4)
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let value = start; value <= max + step * 0.999; value += step)
    ticks.push(Number(value.toFixed(10)))
  return ticks
}

/**
 * Two measures across units (counties), one dot each. Hovering or focusing a dot names it
 * and gives both values. The reference point (the country) is drawn in a second colour and
 * labelled, so it never depends on colour alone.
 */
export default function ScatterChart({
  points,
  xLabel,
  yLabel,
  formatX,
  formatY,
  label,
}: Props) {
  const [hover, setHover] = useState<string | null>(null)
  // Drawn at the container's own width, not scaled or scrolled: on a phone a scatter that
  // scrolls sideways hides half the units, and one that scales shrinks its labels.
  const wrap = useRef<HTMLDivElement>(null)
  const [WIDTH, setWidth] = useState(900)
  useEffect(() => {
    const element = wrap.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, Math.round(entry.contentRect.width))),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const HEIGHT = Math.round(Math.min(420, Math.max(320, WIDTH * 0.62)))
  const plotW = WIDTH - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom

  const { x, y, xTicks, yTicks } = useMemo(() => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const xTicks = rangeTicks(Math.min(...xs), Math.max(...xs))
    const yTicks = rangeTicks(Math.min(...ys), Math.max(...ys))
    return {
      xTicks,
      yTicks,
      x: linearScale(
        [xTicks[0], xTicks.at(-1)!],
        [MARGIN.left, MARGIN.left + plotW],
      ),
      y: linearScale(
        [yTicks[0], yTicks.at(-1)!],
        [MARGIN.top + plotH, MARGIN.top],
      ),
    }
  }, [points, plotW, plotH])

  if (points.length < 2) return null
  const active = points.find((p) => p.key === hover)

  return (
    <figure className="multi-chart scatter-chart">
      <div className="chart-wrap" ref={wrap}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={label}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
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
                {formatY(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={`x${tick}`}
              x={x(tick)}
              y={MARGIN.top + plotH + 20}
              textAnchor="middle"
              className="axis-label"
            >
              {formatX(tick)}
            </text>
          ))}
          <text
            x={MARGIN.left + plotW / 2}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="axis-title"
          >
            {xLabel}
          </text>
          <text
            transform={`translate(16 ${MARGIN.top + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="axis-title"
          >
            {yLabel}
          </text>
          {points.map((p) => (
            <g
              key={p.key}
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${formatX(p.x)}, ${formatY(p.y)}`}
              onPointerEnter={() => setHover(p.key)}
              onFocus={() => setHover(p.key)}
              onBlur={() => setHover(null)}
              className="scatter-dot"
            >
              {/* A hit area larger than the mark. */}
              <circle cx={x(p.x)} cy={y(p.y)} r={14} fill="transparent" />
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r={p.key === hover ? 8 : 6}
                fill={SERIES_COLORS[p.reference ? 1 : 0]}
                stroke="#fbfaf6"
                strokeWidth={2}
              />
              {p.reference && (
                <text
                  x={x(p.x) + 11}
                  y={y(p.y) - 9}
                  className="axis-label scatter-reference"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        {active && (
          <div
            className="chart-tooltip"
            role="status"
            style={
              x(active.x) > WIDTH * 0.66
                ? { right: `${100 - (x(active.x) / WIDTH) * 100}%` }
                : { left: `${(x(active.x) / WIDTH) * 100}%` }
            }
          >
            <strong>{active.label}</strong>
            <div>
              {xLabel}: {formatX(active.x)}
            </div>
            <div>
              {yLabel}: {formatY(active.y)}
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}
