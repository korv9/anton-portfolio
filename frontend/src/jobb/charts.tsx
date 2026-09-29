/**
 * The job-market product's own charts. Ads per month are columns in one hue (the latest year a
 * step darker), since the job is magnitude over time; several fields over time are small
 * multiples, one mini chart each, so no reader has to tell overlapping lines apart by colour.
 */
import { l } from '../i18n'
import { useSize } from '../politik/dash/motion'
import { monthShort, number } from './data'

/** Columns per month. `highlight` marks months from that year on. */
export function MonthColumns({
  months,
  highlight,
  label,
  height: fixed,
}: {
  months: [string, number][]
  highlight?: string
  label: string
  /** A fixed height; otherwise the chart fills its box. */
  height?: number
}) {
  // Drawn at the size of its box, so text and gaps keep their size at any width.
  const [ref, size] = useSize<HTMLDivElement>()
  const width = Math.max(size.width, 200)
  const height = fixed ?? Math.max(size.height, 180)
  const pad = { top: 12, right: 8, bottom: 24, left: 52 }
  const max = Math.max(1, ...months.map(([, v]) => v))
  const step = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / step) * step
  const ticks = [0, top / 2, top]
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const band = plotW / Math.max(1, months.length)
  const gap = band > 6 ? 2 : 1
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  return (
    <div
      ref={ref}
      className="jobb-columns"
      style={fixed ? { height: fixed } : undefined}
    >
      {size.width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                className="jobb-grid"
                x1={pad.left}
                x2={width - pad.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text
                className="jobb-axis"
                x={pad.left - 6}
                y={y(t) + 4}
                textAnchor="end"
              >
                {number(t)}
              </text>
            </g>
          ))}
          {months.map(([month, value], i) => {
            const x = pad.left + i * band
            const recent = highlight ? month >= highlight : false
            return (
              <g key={month} className="jobb-col">
                <rect
                  className={recent ? 'recent' : undefined}
                  x={x + gap / 2}
                  y={y(value)}
                  width={Math.max(1, band - gap)}
                  height={Math.max(0, pad.top + plotH - y(value))}
                />
                {/* A hit target the full height of the plot, larger than the column. */}
                <rect
                  className="jobb-hit"
                  x={x}
                  y={pad.top}
                  width={band}
                  height={plotH}
                >
                  <title>{`${monthShort(month)}: ${number(value)} ${l('ads', 'annonser')}`}</title>
                </rect>
                {month.endsWith('-01') && (
                  <text className="jobb-axis" x={x + 2} y={height - 6}>
                    {month.slice(0, 4)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/** One mini chart per series, each on its own scale, with its latest value and change. */
export function SmallMultiples({
  series,
  note,
}: {
  series: {
    key: string
    name: string
    months: [string, number][]
    value: string
    change: string
  }[]
  note?: string
}) {
  return (
    <div className="jobb-multiples">
      {series.map((s, i) => {
        const max = Math.max(1, ...s.months.map(([, v]) => v))
        const w = 200
        const h = 64
        const points = s.months
          .map(
            ([, v], j) =>
              `${(j / Math.max(1, s.months.length - 1)) * w},${h - (v / max) * (h - 4)}`,
          )
          .join(' ')
        return (
          <figure
            key={s.key}
            className="jobb-multiple"
            style={{ ['--i' as string]: i }}
          >
            <figcaption>
              <b title={s.name}>{s.name}</b>
              <span>
                {s.value} <small>{s.change}</small>
              </span>
            </figcaption>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon
                points={`0,${h} ${points} ${w},${h}`}
                className="jobb-area"
              />
              <polyline points={points} className="jobb-line" />
            </svg>
          </figure>
        )
      })}
      {note && <p className="jobb-note">{note}</p>}
    </div>
  )
}

/** A table shaded by value on one neutral scale, rows × columns, for counts per year. */
export function HeatTable({
  rows,
  columns,
  value,
  format,
  caption,
}: {
  rows: { key: string; label: string }[]
  columns: { key: string; label: string }[]
  value: (row: string, column: string) => number | null | undefined
  format: (v: number) => string
  caption: string
}) {
  const values = rows.flatMap((r) =>
    columns.map((c) => value(r.key, c.key) ?? null),
  )
  const present = values.filter((v): v is number => v != null)
  const top = Math.max(1, ...present)
  const low = Math.min(top, ...present)
  return (
    <table className="dash-heat jobb-heat">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <td />
          {columns.map((c) => (
            <th key={c.key} scope="col">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key} style={{ ['--i' as string]: i }}>
            <th scope="row" title={row.label}>
              {row.label}
            </th>
            {columns.map((c) => {
              const v = value(row.key, c.key)
              if (v == null) return <td key={c.key} className="empty" />
              // Light cells carry dark text and dark cells white; the shades in between are
              // skipped so both keep a readable contrast.
              const t = top > low ? (v - low) / (top - low) : 1
              const dark = t >= 0.5
              const alpha = dark ? 0.62 + (t - 0.5) * 0.5 : 0.05 + t * 0.8
              return (
                <td
                  key={c.key}
                  style={{
                    background: `rgba(17, 18, 20, ${alpha.toFixed(3)})`,
                    color: dark ? '#fff' : undefined,
                  }}
                >
                  {format(v)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
