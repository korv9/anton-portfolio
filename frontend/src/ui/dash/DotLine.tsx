/**
 * The dashboard's main chart: one series as dots on a true time axis, joined by a thin line,
 * with the latest point as the one accent. It fills its card's width and a fixed height;
 * hovering or focusing shows the nearest point.
 */
import { useEffect, useRef, useState } from 'react'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'

export type DotPoint = { date: string; label: string; value: number }

const M = { top: 16, right: 16, bottom: 28, left: 52 }

export default function DotLine({
  points,
  label,
  format,
  tick = format,
  height = 300,
  color = 'var(--ink)',
  from,
}: {
  points: DotPoint[]
  label: string
  format: (value: number) => string
  /** The y axis labels; the tooltip's format when not given. */
  tick?: (value: number) => string
  height?: number
  /** The accent: the latest point and the line (a party's colour when the party is measured). */
  color?: string
  /** The bottom of the y axis; zero unless given. */
  from?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width))),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  if (!points.length) return null
  const time = (p: DotPoint) => Date.parse(p.date)
  const max = Math.max(...points.map((p) => p.value))
  const ticks = niceTicks(max - (from ?? 0), 4).map((t) => t + (from ?? 0))
  const x = linearScale(
    [time(points[0]), Math.max(time(points[0]) + 1, time(points.at(-1)!))],
    [M.left, width - M.right],
  )
  const y = linearScale(
    [from ?? 0, ticks.at(-1) ?? 1],
    [height - M.bottom, M.top],
  )
  const years = yearTicks(points.map((p) => p.date))
  const step = Math.ceil(years.length / Math.max(2, Math.floor(width / 70)))
  const last = points.length - 1
  const shown = hover ?? last
  const tip = points[shown]
  const nearest = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect()
    const at = clientX - rect.left
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(time(p)) - at) < Math.abs(x(time(points[best])) - at))
        best = i
    })
    return best
  }
  return (
    <div
      ref={box}
      className="dk-dotline"
      onPointerMove={(e) => setHover(nearest(e.clientX))}
      onPointerLeave={() => setHover(null)}
    >
      <p className="dk-tip" aria-live="polite">
        <span>{tip.label}</span> <b>{format(tip.value)}</b>
      </p>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${points[0].label}: ${format(points[0].value)}; ${points[last].label}: ${format(points[last].value)}.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
            />
            <text
              x={M.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="dk-axis"
            >
              {tick(t)}
            </text>
          </g>
        ))}
        {years
          .filter((_, i) => i % step === 0)
          .map((t) => (
            <text
              key={t.label}
              x={x(time(points[t.index]))}
              y={height - 8}
              textAnchor="middle"
              className="dk-axis"
            >
              {t.label}
            </text>
          ))}
        <polyline
          points={points.map((p) => `${x(time(p))},${y(p.value)}`).join(' ')}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={x(time(p))}
            cy={y(p.value)}
            r={i === shown ? 6 : 3.5}
            fill={i === last || i === hover ? color : 'var(--ink-2)'}
            stroke="var(--paper)"
            strokeWidth="2"
          />
        ))}
        {hover != null && (
          <line
            x1={x(time(points[hover]))}
            x2={x(time(points[hover]))}
            y1={M.top}
            y2={height - M.bottom}
            stroke="var(--line-strong)"
            strokeDasharray="3,3"
          />
        )}
      </svg>
    </div>
  )
}
