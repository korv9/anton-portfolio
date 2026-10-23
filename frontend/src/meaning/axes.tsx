/**
 * One axis style for the feed's SVG charts. Ticks come from the same scale and domain the
 * marks use, so a label can never sit at another value than its gridline. meaning.css styles
 * `.mean-axis` gridlines and tick text once for every family.
 */
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

/** Nice ticks inside `[lo, hi]`, for axes that do not start at zero. */
export function ticksBetween(lo: number, hi: number, count = 4) {
  const step = niceStep(hi - lo, count)
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step)
    out.push(Number(v.toFixed(10)))
  return out
}

/** Horizontal gridlines across `[x0, x1]` with the value, formatted with its unit, on the left. */
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
          <text x={x0 - 4} y={y(t) + 3.5} textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

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
        <text key={t.value} x={x(t.value)} y={y} textAnchor="middle">
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

/**
 * Direct labels at the end of lines, moved apart so none overlap (charts/marks spreadLabels).
 * Each label takes its line's colour where it has one.
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
  return (
    <g className="mean-end">
      {spreadLabels(items, gap, top, bottom).map((l) => (
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
