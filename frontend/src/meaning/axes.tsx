/**
 * Shared axes for the feed's SVG charts; families move onto it as they are converted. Ticks come from the same scale and domain the
 * marks use, so a label can never sit at another value than its gridline. meaning.css styles
 * `.mean-axis` gridlines and tick text once for every family.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { spreadLabels } from '../charts/marks'
import { niceStep } from '../charts/scales'

type Scale = (v: number) => number

/** `[lo, hi]` widened out to whole nice steps, so the top gridline is the top of the chart. */
export function niceDomain(
  lo: number,
  hi: number,
  count = 4,
): [number, number] {
  const step = niceStep(hi - lo, count)
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

/** Nice ticks inside `[lo, hi]`, for axes that do not start at zero. Pass the step niceDomain
 * used (`niceStep(rawHi - rawLo, count)`) so the gridlines meet the domain's ends. */
export function ticksBetween(
  lo: number,
  hi: number,
  count = 4,
  step = niceStep(hi - lo, count),
) {
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step)
    out.push(Number(v.toFixed(10)))
  return out
}

/** Horizontal gridlines across `[x0, x1]` with the value, formatted with its unit, on the left,
 * centred on its line at any text size. */
export function YAxis({
  y,
  ticks,
  x0,
  x1,
  format = String,
}: {
  y: Scale
  ticks: number[]
  x0: number
  x1: number
  format?: (v: number) => string
}) {
  return (
    <g className="mean-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
          <text x={x0 - 4} y={y(t)} dy="0.35em" textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Where an x tick label's baseline sits for a `y` given at the nominal 10-unit text size: from
 * about the plot's bottom (`y` − 12) one and a third lines down, so the gap to the plot and
 * to the lowest y label grows with the text the card draws. */
export const xTickY = (y: number) => ({ y: y - 12, dy: '1.35em' })

/** Tick labels under the plot at positions from the x scale, e.g. `yearTicks` indexes. */
export function XAxis({
  x,
  ticks,
  y,
}: {
  x: Scale
  ticks: { value: number; label: string }[]
  y: number
}) {
  return (
    <g className="mean-axis">
      {ticks.map((t) => (
        <text key={t.value} x={x(t.value)} {...xTickY(y)} textAnchor="middle">
          {t.label}
        </text>
      ))}
    </g>
  )
}

/** A reference line (a national figure, a threshold) with its name at the right end. */
export function RefLine({
  y,
  x0,
  x1,
  label,
}: {
  y: number
  x0: number
  x1: number
  label?: string
}) {
  return (
    <g className="mean-axis mean-ref">
      <line x1={x0} x2={x1} y1={y} y2={y} strokeDasharray="3 3" />
      {label && (
        <text x={x1} y={y - 4} textAnchor="end">
          {label}
        </text>
      )}
    </g>
  )
}

/** The font size of the first text in `ref`, in drawing units, read again whenever the card
 * rescales its chart (fit.ts sets --mean-s on the svg's style). */
function useFontSize(ref: RefObject<SVGGElement | null>) {
  const [size, setSize] = useState(0)
  useLayoutEffect(() => {
    const g = ref.current
    const svg = g?.ownerSVGElement
    if (!g || !svg) return
    const read = () => {
      const t = g.querySelector('text')
      setSize(t ? parseFloat(getComputedStyle(t).fontSize) : 0)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(svg, { attributes: true, attributeFilter: ['style'] })
    return () => mo.disconnect()
  }, [ref])
  return size
}

/**
 * Direct labels at the end of lines, moved apart so none overlap (charts/marks spreadLabels).
 * The gap is the labels' own line height at the size they are drawn. When more labels than
 * fit, the first item (the focal line), the top and the bottom line keep theirs, then the rest
 * in order while room lasts. Each label takes its line's colour where it has one.
 */
export function EndLabels({
  items,
  x,
  top,
  bottom,
  gap = 12,
}: {
  items: { y: number; label: string; color?: string }[]
  x: number
  top: number
  bottom: number
  gap?: number
}) {
  const ref = useRef<SVGGElement>(null)
  const step = Math.max(gap, useFontSize(ref))
  const room = Math.floor((bottom - top) / step) + 1
  let shown = items
  if (items.length > room) {
    const byY = [...items].sort((a, b) => a.y - b.y)
    const first = [items[0], byY[0], byY.at(-1)!]
    shown = [...new Set([...first, ...items])].slice(0, Math.max(1, room))
  }
  return (
    <g className="mean-end" ref={ref}>
      {spreadLabels(shown, step, top, bottom).map((l) => (
        <text
          key={l.label}
          x={x}
          y={l.labelY + 4}
          style={l.color ? { fill: l.color } : undefined}
        >
          {l.label}
        </text>
      ))}
    </g>
  )
}
