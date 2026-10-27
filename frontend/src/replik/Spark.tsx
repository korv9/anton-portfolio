/**
 * A small line over shared periods, for the per-party small multiples. The SVG stretches to its
 * box and every label is HTML, so text stays readable at any width. Each party's chart has the
 * same scale, size and ink: no party is coloured or ranked above another.
 */
export type SparkPoint = {
  period: string
  value: number
  low?: number
  high?: number
}

export default function Spark({
  title,
  periods,
  points,
  min,
  max,
  format,
  label,
  shade,
  refValue,
  note,
  large,
}: {
  title: string
  /** Every period of the shared x axis, in order; a point sits at its period's position. */
  periods: string[]
  points: SparkPoint[]
  min: number
  max: number
  format: (value: number) => string
  /** What the chart shows, for screen readers. */
  label: string
  /** Periods drawn with a shaded column behind them. */
  shade?: Set<string>
  /** A reference line (chance, say). */
  refValue?: number
  note?: string
  large?: boolean
}) {
  const W = 100
  const H = 40
  const x = (p: string) =>
    periods.length < 2 ? W / 2 : (periods.indexOf(p) / (periods.length - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H
  const step = periods.length < 2 ? W : W / (periods.length - 1)
  const shown = points.filter((p) => periods.includes(p.period))
  const banded = shown.filter((p) => p.low != null && p.high != null)
  const band =
    banded.length > 1
      ? [
          ...banded.map((p) => `${x(p.period)},${y(p.high!)}`),
          ...[...banded].reverse().map((p) => `${x(p.period)},${y(p.low!)}`),
        ].join(' ')
      : null
  const last = shown.at(-1)
  return (
    <figure className={`rk-spark${large ? ' is-large' : ''}`}>
      <figcaption>
        <strong>{title}</strong>
        {last && (
          <span>
            {format(last.value)} <small>{last.period}</small>
          </span>
        )}
      </figcaption>
      <div className="rk-spark-plot">
        <span className="rk-spark-y" aria-hidden="true">
          <span>{format(max)}</span>
          <span>{format(min)}</span>
        </span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
        >
          {periods.map((p) =>
            shade?.has(p) ? (
              <rect
                key={p}
                className="rk-spark-shade"
                x={x(p) - step / 2}
                width={step + 0.2}
                y={0}
                height={H}
              />
            ) : null,
          )}
          {refValue != null && (
            <line
              className="rk-spark-ref"
              x1={0}
              x2={W}
              y1={y(refValue)}
              y2={y(refValue)}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {band && <polygon className="rk-spark-band" points={band} />}
          <polyline
            className="rk-spark-line"
            points={shown.map((p) => `${x(p.period)},${y(p.value)}`).join(' ')}
            vectorEffect="non-scaling-stroke"
          />
          {shown.map((p) => (
            <rect
              key={p.period}
              className="rk-spark-hit"
              x={x(p.period) - step / 2}
              width={step}
              y={0}
              height={H}
            >
              <title>
                {`${p.period}: ${format(p.value)}${p.low != null && p.high != null ? ` (${format(p.low)}–${format(p.high)})` : ''}`}
              </title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="rk-spark-x" aria-hidden="true">
        <span>{periods[0]}</span>
        <span>{periods.at(-1)}</span>
      </div>
      {note && <p className="rk-spark-note">{note}</p>}
    </figure>
  )
}
