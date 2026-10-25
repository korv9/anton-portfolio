/**
 * The small charts on the projects hub's cards: a line in SVG and a set of bars in HTML, each with
 * one tooltip line that follows the pointer, a tap and the arrow keys. The chart takes focus as
 * one stop, and its text alternative names the finding. Labels are HTML, so they keep the page's
 * text size at any width. `Near` mounts a card's chart, and so fetches its data, only when the
 * card comes close to the viewport; `Loading` holds the chart's room until the data arrives.
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

/** Renders its children once the element is within 300 px of the viewport. */
export function Near(props: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={props.className}>
      {near ? props.children : <div className="mini-loading" />}
    </div>
  )
}

/** The room a chart takes while its file loads; a missing file leaves nothing. */
export const Loading = () => <div className="mini-loading" />

/** Moves the active index with the arrow keys, Home and End. */
function useActive(count: number) {
  const [active, setActive] = useState<number | null>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(count - 1)
    else if (step)
      setActive((a) => Math.min(count - 1, Math.max(0, (a ?? -1) + step)))
    else return
    e.preventDefault()
  }
  /** A mouse leaving clears the tooltip; a tap keeps it until the next tap or blur. */
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setActive(null)
  }
  return { active, setActive, onKeyDown, onPointerLeave }
}

export type LinePoint = { x: number; y: number; label: string }
export type LineSeries = { id: string; name: string; points: LinePoint[] }

const LW = 480
const LH = 150
const LP = { top: 10, right: 8, bottom: 6, left: 6 }

/**
 * Lines over a shared x range. The first series is the highlighted one, in the focal accent with
 * its last value labelled; the others are grey context, each labelled with its name at its end.
 * `mark` puts a grey dot and label on one point of the highlighted series, such as its peak.
 */
export function MiniLine(props: {
  series: LineSeries[]
  /** The finding, read as the chart's text alternative. */
  summary: string
  format: (y: number) => string
  ticks: { x: number; label: string }[]
  mark?: { index: number; label: string }
  /** Replaces the last value's label, e.g. to flag a partial year. */
  endLabel?: string
}) {
  const { series, summary, format, ticks, mark, endLabel } = props
  const main = series[0]
  const { active, setActive, onKeyDown, onPointerLeave } = useActive(
    main.points.length,
  )
  const all = series.flatMap((s) => s.points)
  const x0 = Math.min(...all.map((p) => p.x))
  const x1 = Math.max(...all.map((p) => p.x))
  const top = Math.max(1e-9, ...all.map((p) => p.y))
  const x = (v: number) =>
    LP.left + ((v - x0) / Math.max(1, x1 - x0)) * (LW - LP.left - LP.right)
  const y = (v: number) => LP.top + (1 - v / top) * (LH - LP.top - LP.bottom)
  const path = (points: LinePoint[]) =>
    points
      .map(
        (p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`,
      )
      .join('')
  // Positions for the HTML labels, as shares of the drawing.
  const left = (v: number) => `${(x(v) / LW) * 100}%`
  const down = (v: number) => `${(y(v) / LH) * 100}%`
  const nearest = (clientX: number, box: DOMRect) => {
    const vx = ((clientX - box.left) / box.width) * LW
    let best = 0
    main.points.forEach((p, i) => {
      if (Math.abs(x(p.x) - vx) < Math.abs(x(main.points[best].x) - vx))
        best = i
    })
    return best
  }
  const last = main.points[main.points.length - 1]
  const hit = active === null ? null : main.points[active]
  const marked = mark && main.points[mark.index]
  return (
    <div className="mini">
      <div className="mini-plot">
        <svg
          viewBox={`0 0 ${LW} ${LH}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={onPointerLeave}
          onPointerDown={(e) =>
            setActive(
              nearest(e.clientX, e.currentTarget.getBoundingClientRect()),
            )
          }
          onPointerMove={(e) =>
            setActive(
              nearest(e.clientX, e.currentTarget.getBoundingClientRect()),
            )
          }
        >
          {series.slice(1).map((s) => (
            <path
              key={s.id}
              className="mini-line mini-context"
              d={path(s.points)}
            />
          ))}
          <path className="mini-line mini-focal" d={path(main.points)} />
          {marked && (
            <circle
              className="mini-mark"
              cx={x(marked.x)}
              cy={y(marked.y)}
              r="3.5"
            />
          )}
          <circle className="mini-end" cx={x(last.x)} cy={y(last.y)} r="3.5" />
          {hit && (
            <g className="mini-cursor">
              <line x1={x(hit.x)} x2={x(hit.x)} y1={LP.top} y2={y(0)} />
              <circle cx={x(hit.x)} cy={y(hit.y)} r="4" />
            </g>
          )}
        </svg>
        <span
          className="mini-label mini-label-end"
          style={{ left: left(last.x), top: down(last.y) }}
          aria-hidden="true"
        >
          {endLabel ?? format(last.y)}
        </span>
        {series.slice(1).map((s) => {
          const end = s.points[s.points.length - 1]
          return (
            <span
              key={s.id}
              className="mini-label mini-label-context"
              style={{ left: left(end.x), top: down(end.y) }}
              aria-hidden="true"
            >
              {s.name}
            </span>
          )
        })}
        {marked && mark && (
          <span
            className="mini-label mini-label-mark"
            style={{ left: left(marked.x), top: down(marked.y) }}
            aria-hidden="true"
          >
            {mark.label}
          </span>
        )}
      </div>
      <div className="mini-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.label} style={{ left: left(t.x) }}>
            {t.label}
          </span>
        ))}
      </div>
      <p className="mini-tip" aria-live="polite">
        {hit ? `${hit.label}: ${format(hit.y)}` : ' '}
      </p>
    </div>
  )
}

export type Bar = {
  label: string
  value: number
  note?: string
  focal?: boolean
}

/**
 * Horizontal bars in HTML, so their names and values keep the page's text size on a phone; each
 * is labelled directly. A dashed reference line is optional. The list takes focus as one stop.
 */
export function MiniBars(props: {
  bars: Bar[]
  summary: string
  format: (v: number) => string
  /** A value to mark with a dashed line, such as chance or 100 %. */
  reference?: { value: number; label: string }
  max?: number
}) {
  const { bars, summary, format, reference } = props
  const { active, setActive, onKeyDown, onPointerLeave } = useActive(
    bars.length,
  )
  const max = Math.max(
    1e-9,
    props.max ?? 0,
    reference?.value ?? 0,
    ...bars.map((b) => b.value),
  )
  const at = (v: number) => `${(v / max) * 100}%`
  const hit = active === null ? null : bars[active]
  return (
    <div className="mini">
      <div
        className="mini-bars"
        role="img"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={onPointerLeave}
      >
        {bars.map((b, i) => (
          <div
            key={b.label}
            className="mini-bar"
            data-focal={b.focal || undefined}
            data-active={i === active || undefined}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          >
            <span className="mini-bar-label">{b.label}</span>
            <span className="mini-bar-track">
              <span className="mini-bar-fill" style={{ width: at(b.value) }} />
              {reference && (
                <span
                  className="mini-bar-ref"
                  style={{ left: at(reference.value) }}
                />
              )}
            </span>
            <span className="mini-bar-value">{format(b.value)}</span>
          </div>
        ))}
      </div>
      <p className="mini-tip" aria-live="polite">
        {hit
          ? `${hit.label}: ${format(hit.value)}${hit.note ? ` · ${hit.note}` : ''}`
          : reference
            ? reference.label
            : ' '}
      </p>
    </div>
  )
}
