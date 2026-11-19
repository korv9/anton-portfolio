/**
 * The outdoor page's own marks, where RankBars and MultiLineChart cannot say it: an hour-by-
 * station heatmap, predictions with intervals, and opening-year ranges against the official
 * forecasts. HTML and CSS, so labels wrap on a phone; every value is also in the view's table.
 */
import { l } from '../i18n'
import { count, fixed } from '../format'

/** A decimal year as the calendar year it falls in, without a thousands separator. */
const year = (v: number) => String(Math.floor(v))

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Stations by row, clock hours by column; darker is a larger audience index. */
export function Heatmap({
  rows,
  max,
}: {
  rows: { key: string; label: string; values: number[] }[]
  max: number
}) {
  return (
    <figure
      className="od-heat"
      aria-label={l(
        'Audience index per station and hour',
        'Publikindex per station och timme',
      )}
    >
      <div className="od-heat-grid" role="presentation">
        <span />
        {HOURS.map((h) => (
          <span key={h} className="od-heat-hour">
            {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
          </span>
        ))}
        {rows.map((r) => (
          <div key={r.key} className="od-heat-row">
            <span className="od-heat-label">{r.label}</span>
            {r.values.map((v, h) => (
              <span
                key={h}
                className={v > 0 ? 'od-heat-cell' : 'od-heat-cell is-missing'}
                style={{
                  opacity: v > 0 ? 0.12 + 0.88 * Math.min(v / max, 1) : 1,
                }}
                title={`${r.label} ${String(h).padStart(2, '0')}:00 · ${v > 0 ? fixed(v) : l('no service', 'ingen trafik')}`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="od-key">
        <span className="od-key-ramp" aria-hidden="true" />
        {l(
          `0 to ${fixed(max)} and above; hatched: no metro service that hour`,
          `0 till ${fixed(max)} och mer; streckat: ingen tunnelbana den timmen`,
        )}
      </figcaption>
    </figure>
  )
}

/** One row per item: a point and its interval on a shared axis from 0, with a reference line. */
export function IntervalRows({
  rows,
  reference,
  referenceLabel,
}: {
  rows: {
    key: string
    label: string
    note?: string
    value: number
    low: number
    high: number
  }[]
  reference: number
  referenceLabel: string
}) {
  const top = Math.max(...rows.map((r) => r.high), reference) * 1.05
  const at = (v: number) => `${(100 * v) / top}%`
  return (
    <figure className="od-rows" aria-label={referenceLabel}>
      <ol>
        {rows.map((r) => (
          <li key={r.key}>
            <span className="od-row-label">
              {r.label}
              {r.note && <small>{r.note}</small>}
            </span>
            <span className="od-track">
              <span className="od-ref" style={{ left: at(reference) }} />
              <span
                className="od-range"
                style={{
                  left: at(r.low),
                  width: `calc(${at(r.high)} - ${at(r.low)})`,
                }}
              />
              <span className="od-point" style={{ left: at(r.value) }} />
            </span>
            <span className="od-row-value">
              {count(r.value)}
              <small>
                {count(r.low)}–{count(r.high)}
              </small>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="od-key">
        <span className="od-key-ref" aria-hidden="true" /> {referenceLabel}
      </figcaption>
    </figure>
  )
}

/** One row per branch on a year axis: each official forecast as a small dot, the latest as a
 * ring, and the 10–90 % range of the opening year with its median. */
export function YearRows({
  rows,
  from,
  to,
  now,
}: {
  rows: {
    key: string
    label: string
    forecasts: number[]
    latest: number
    p10: number | null
    p50: number | null
    p90: number | null
  }[]
  from: number
  to: number
  now: number
}) {
  const at = (v: number) =>
    `${(100 * (Math.min(Math.max(v, from), to) - from)) / (to - from)}%`
  const ticks = Array.from(
    { length: Math.floor((to - from) / 5) + 1 },
    (_, i) => from + i * 5,
  )
  return (
    <figure
      className="od-rows od-years"
      aria-label={l('Opening year per branch', 'Öppningsår per sträcka')}
    >
      <ol>
        {rows.map((r) => (
          <li key={r.key}>
            <span className="od-row-label">{r.label}</span>
            <span className="od-track">
              <span className="od-ref" style={{ left: at(now) }} />
              {r.p10 !== null && (
                <span
                  className="od-range"
                  style={{
                    left: at(r.p10),
                    width: `calc(${at(r.p90 ?? to)} - ${at(r.p10)})`,
                  }}
                />
              )}
              {r.forecasts.map((f, i) => (
                <span key={i} className="od-dot" style={{ left: at(f) }} />
              ))}
              <span className="od-ring" style={{ left: at(r.latest) }} />
              {r.p50 !== null && (
                <span className="od-point" style={{ left: at(r.p50) }} />
              )}
            </span>
            <span className="od-row-value">
              {r.p50 !== null ? year(r.p50) : l('after 2060', 'efter 2060')}
              <small>
                {r.p10 !== null ? year(r.p10) : '–'}–
                {r.p90 !== null ? year(r.p90) : '2060+'}
              </small>
            </span>
          </li>
        ))}
      </ol>
      <div className="od-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {t}
          </span>
        ))}
      </div>
      <figcaption className="od-key">
        <span className="od-key-dot" aria-hidden="true" />
        {l('official forecast', 'officiell prognos')}
        <span className="od-key-ring" aria-hidden="true" />
        {l('latest forecast', 'senaste prognos')}
        <span className="od-key-range" aria-hidden="true" />
        {l('10–90 % range, median', '10–90 %-intervall, median')}
        <span className="od-key-ref" aria-hidden="true" />
        {l('today', 'i dag')}
      </figcaption>
    </figure>
  )
}

/** Lines over the 24 clock hours, each labelled at its peak; values are shares of a day. */
export function HourLines({
  series,
  label,
}: {
  series: { key: string; name: string; values: number[]; focal?: boolean }[]
  label: string
}) {
  const W = 720
  const H = 260
  const M = { top: 16, right: 16, bottom: 28, left: 44 }
  const top = Math.max(...series.flatMap((s) => s.values)) * 1.1
  const x = (h: number) => M.left + ((W - M.left - M.right) * h) / 23
  const y = (v: number) => H - M.bottom - ((H - M.top - M.bottom) * v) / top
  const ticks = [0, top / 2, top].map((v) => Math.round(v * 100) / 100)
  return (
    <figure className="od-lines" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              className="od-grid"
            />
            <text
              x={M.left - 6}
              y={y(t) + 4}
              textAnchor="end"
              className="od-axis-text"
            >
              {`${fixed(t * 100)} %`}
            </text>
          </g>
        ))}
        {HOURS.filter((h) => h % 3 === 0).map((h) => (
          <text
            key={h}
            x={x(h)}
            y={H - 8}
            textAnchor="middle"
            className="od-axis-text"
          >
            {String(h).padStart(2, '0')}
          </text>
        ))}
        {series.map((s) => {
          const peak = s.values.indexOf(Math.max(...s.values))
          return (
            <g key={s.key} className={s.focal ? 'od-line is-focal' : 'od-line'}>
              <polyline
                points={s.values.map((v, h) => `${x(h)},${y(v)}`).join(' ')}
              />
              <text x={x(peak)} y={y(s.values[peak]) - 8} textAnchor="middle">
                {s.name}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
