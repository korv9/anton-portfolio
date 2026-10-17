/**
 * Seats per party as bare strokes from the left edge of the screen to the right: no frame, no
 * grid, a party letter with its seats where each line starts and ends, and the election years
 * underneath. Pointing at an election reads out every party's seats that year, and pointing at
 * a line lifts it out of the others.
 */
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { partyLine, partyName } from '../../parties/identity'
import { useWidth } from '../../charts/feature/Feature'

export type SeatLine = {
  key: string
  /** Seats per election, in the order of `years`. */
  seats: number[]
}

const TOP = 28
const BOTTOM = 52
/** Room at the right for the party letters and their seats. */
const END = 78
const LABEL_GAP = 15

/** Labels at one end, each beside its line, pushed apart where lines run close. */
function spread(rows: { key: string; y: number; seats: number }[]) {
  const sorted = rows.filter((r) => r.seats > 0).sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++)
    sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + LABEL_GAP)
  for (let i = sorted.length - 2; i >= 0; i--)
    sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - LABEL_GAP)
  return sorted
}

export default function SeatLines({
  years,
  lines,
  label,
  ceiling,
}: {
  years: number[]
  lines: SeatLine[]
  label: string
  ceiling: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>(1200)
  // The election pointed at stays after the pointer leaves, so the guide fades where it stood.
  const [picked, setPicked] = useState<number | null>(null)
  const [on, setOn] = useState(false)
  const [hot, setHot] = useState<string | null>(null)
  const narrow = width < 700
  const HEIGHT = narrow ? 360 : 440
  const left = 38
  const x1 = width - (narrow ? 52 : END)
  const first = years[0]
  const span = years.at(-1)! - first
  const x = (i: number) =>
    left + ((years[i] - first) / (span || 1)) * (x1 - left)
  // Keep the scale stable when a party is selected.
  const top = ceiling
  const y = (seats: number) =>
    HEIGHT - BOTTOM - (seats / top) * (HEIGHT - BOTTOM - TOP)
  const last = years.length - 1
  const at = Math.min(picked ?? last, last)

  // Start at the first seats: the chart does not date a party's entry between elections.
  const path = (seats: number[]) => {
    const start = seats.findIndex((n) => n > 0)
    if (start < 0) return ''
    return seats
      .map((n, i) => {
        if (i < start) return ''
        if (i === start) return `M${x(i)},${y(n)}`
        return `L${x(i)},${y(n)}`
      })
      .join(' ')
  }
  const labels = (i: number) =>
    spread(
      lines.map((line) => ({
        key: line.key,
        y: y(line.seats[i]),
        seats: line.seats[i],
      })),
    )
  const pick = (clientX: number, box: DOMRect) => {
    const px = clientX - box.left
    let best = 0
    years.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    })
    setPicked(best)
    setOn(true)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowLeft' ? -1 : 1
    setPicked(Math.min(last, Math.max(0, (on ? at : last) + step)))
    setOn(true)
  }
  const leave = () => {
    setOn(false)
    setHot(null)
  }
  const every = narrow ? 4 : 1
  const side = x(at) > width - 320 ? 'left' : 'right'

  return (
    <div
      ref={ref}
      className="seat-lines"
      data-on={on || undefined}
      data-hot={hot ? true : undefined}
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby="seat-lines-help"
      onKeyDown={onKey}
      onBlur={leave}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) =>
        pick(e.clientX, e.currentTarget.getBoundingClientRect())
      }
      onPointerLeave={leave}
    >
      <svg width={width} height={HEIGHT} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (top * i) / 4).map((v) => (
          <g key={v} className="seat-lines-scale">
            <line x1={left} x2={x1} y1={y(v)} y2={y(v)} />
            <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <line
          className="seat-lines-guide"
          y1={TOP}
          y2={HEIGHT - BOTTOM}
          style={{ transform: `translateX(${x(at)}px)` }}
        />
        {lines.map((line) => (
          <path
            key={line.key}
            className="seat-lines-stroke"
            data-hot={line.key === hot || undefined}
            d={path(line.seats)}
            stroke={partyLine(line.key)}
          />
        ))}
        {lines.length <= 2 &&
          lines.flatMap((line) =>
            line.seats.map(
              (seats, i) =>
                seats > 0 && (
                  <circle
                    key={`${line.key}-${years[i]}`}
                    cx={x(i)}
                    cy={y(seats)}
                    r={3}
                    fill="var(--paper)"
                    stroke={partyLine(line.key)}
                  />
                ),
            ),
          )}
        {lines.map((line) => (
          <circle
            key={line.key}
            className="seat-lines-dot"
            data-hot={line.key === hot || undefined}
            data-empty={line.seats[at] > 0 ? undefined : true}
            r={4}
            fill={partyLine(line.key)}
            style={{
              transform: `translate(${x(at)}px, ${y(line.seats[at])}px)`,
            }}
          />
        ))}
        {years.map(
          (year, i) =>
            (i % every === 0 || i === last) && (
              <text
                key={year}
                className="seat-lines-year"
                data-at={(on && i === at) || undefined}
                x={Math.max(x(i), 16)}
                y={HEIGHT - 14}
                textAnchor={i === 0 ? 'start' : 'middle'}
              >
                {year}
              </text>
            ),
        )}
        {labels(last).map((row) => (
          <g key={`end-${row.key}`}>
            <path
              className="seat-lines-label-link"
              d={`M${x1 + 2},${y(row.seats)} L${x1 + 7},${row.y}`}
            />
            <text
              className="seat-lines-label"
              data-hot={row.key === hot || undefined}
              x={x1 + 10}
              y={row.y + 4}
            >
              <tspan className="seat-lines-code">{row.key}</tspan> {row.seats}
            </text>
          </g>
        ))}
        {/* Wide unseen strokes on top, so a thin line is easy to point at. */}
        {lines.map((line) => (
          <path
            key={line.key}
            className="seat-lines-hit"
            d={path(line.seats)}
            onPointerEnter={() => setHot(line.key)}
            onPointerLeave={() => setHot(null)}
          />
        ))}
      </svg>
      <p id="seat-lines-help" className="visually-hidden">
        Use the left and right arrow keys to read each election. Exact values
        are also available in the table.
      </p>
      <div
        className="seat-lines-tip"
        role="status"
        style={{
          transform:
            side === 'left'
              ? `translateX(calc(${x(at)}px - 100% - 1rem))`
              : `translateX(calc(${x(at)}px + 1rem))`,
        }}
      >
        <b>{years[at]}</b>
        {[...lines]
          .filter((line) => line.seats[at] > 0)
          .sort((a, b) => b.seats[at] - a.seats[at])
          .map((line) => (
            <span key={line.key} data-hot={line.key === hot || undefined}>
              <i style={{ background: partyLine(line.key) }} />
              {partyName(line.key)}
              <em>{line.seats[at]}</em>
            </span>
          ))}
      </div>
    </div>
  )
}
