/**
 * Small comparisons the long read uses beside the ranked bars, built in HTML like them so
 * labels wrap on a phone and every number is written out: a bullet (one value against a
 * reference), a dumbbell (two values per row, joined), stacked shares (parts of a whole per row,
 * 100 % wide) and a box plot (how observations spread).
 */
import type { ReactNode } from 'react'
import './charts.css'

/** One value as a bar on a fixed scale, with the reference it is judged against as a tick. */
export function Bullet({
  value,
  reference,
  max,
  valueLabel,
  referenceLabel,
  format,
  colour,
  label,
}: {
  value: number
  reference: number
  max: number
  valueLabel: string
  referenceLabel: string
  format: (v: number) => string
  colour?: string
  /** What the chart shows, for screen readers. */
  label: string
}) {
  return (
    <figure className="bullet" aria-label={label}>
      <div className="bullet-track" aria-hidden="true">
        <i style={{ width: `${(value / max) * 100}%`, background: colour }} />
        <b style={{ left: `${(reference / max) * 100}%` }} />
      </div>
      <dl className="bullet-key">
        <div>
          <dt>{valueLabel}</dt>
          <dd>{format(value)}</dd>
        </div>
        <div>
          <dt>{referenceLabel}</dt>
          <dd>{format(reference)}</dd>
        </div>
      </dl>
    </figure>
  )
}

export type DumbbellRow = {
  key: string
  label: ReactNode
  /** The earlier or reference value, drawn hollow. */
  from: number
  /** The value the row is about, drawn solid. */
  to: number
  colour?: string
}

/** Two values per row on one scale, joined by a line: the gap is the message. */
export function Dumbbell({
  rows,
  fromLabel,
  toLabel,
  format,
  max,
  label,
}: {
  rows: DumbbellRow[]
  fromLabel: string
  toLabel: string
  format: (v: number) => string
  max?: number
  label: string
}) {
  const top = max ?? Math.max(...rows.flatMap((r) => [r.from, r.to]), 1) * 1.05
  const at = (v: number) => `${(v / top) * 100}%`
  return (
    <figure className="dumbbell" aria-label={label}>
      <p className="dumbbell-key" aria-hidden="true">
        <span className="hollow">{fromLabel}</span>
        <span>{toLabel}</span>
      </p>
      <ol>
        {rows.map((r) => (
          <li key={r.key} style={{ ['--c' as string]: r.colour }}>
            <span className="rank-label">{r.label}</span>
            <span className="dumbbell-track" aria-hidden="true">
              <i
                style={{
                  left: at(Math.min(r.from, r.to)),
                  width: at(Math.abs(r.to - r.from)),
                }}
              />
              <b className="hollow" style={{ left: at(r.from) }} />
              <b style={{ left: at(r.to) }} />
            </span>
            <span className="rank-value">
              {format(r.to)}
              <small>{format(r.from)}</small>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}

/** Parts of a whole per row, every row 100 % wide, with the parts named once above. */
export function Stacked({
  rows,
  parts,
  format,
  label,
}: {
  /** `text` replaces the first part's share at the end of a row. */
  rows: { key: string; label?: ReactNode; values: number[]; text?: string }[]
  parts: { label: string; colour: string }[]
  format: (v: number) => string
  label: string
}) {
  return (
    <figure className="stacked" aria-label={label}>
      <p className="stacked-key">
        {parts.map((p) => (
          <span key={p.label} style={{ ['--c' as string]: p.colour }}>
            {p.label}
          </span>
        ))}
      </p>
      <ol>
        {rows.map((r) => {
          const total = r.values.reduce((n, v) => n + v, 0) || 1
          return (
            <li key={r.key} className={r.label ? undefined : 'bare'}>
              {r.label && <span className="rank-label">{r.label}</span>}
              <span className="stacked-track">
                {r.values.map((v, i) => (
                  <i
                    key={parts[i].label}
                    title={`${parts[i].label}: ${format(v)}`}
                    style={{
                      width: `${(v / total) * 100}%`,
                      background: parts[i].colour,
                    }}
                  />
                ))}
              </span>
              <span className="rank-value">
                {r.label ? (
                  (r.text ?? `${Math.round((r.values[0] / total) * 100)} %`)
                ) : (
                  <>
                    <b>{Math.round((r.values[0] / total) * 100)} %</b>
                    <small>
                      {format(r.values[0])} / {format(total)}
                    </small>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

/** How a set of observations spreads: the range as a line, the middle half as a box, the median as a tick. */
export function BoxPlot({
  values,
  format,
  label,
}: {
  values: number[]
  format: (v: number) => string
  label: string
}) {
  const sorted = [...values].sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.round((sorted.length - 1) * p)]
  const [min, q1, median, q3, max] = [0, 0.25, 0.5, 0.75, 1].map(q)
  const at = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`
  return (
    <figure className="boxplot" aria-label={label}>
      <div className="boxplot-track" aria-hidden="true">
        <i style={{ left: at(q1), width: `calc(${at(q3)} - ${at(q1)})` }} />
        <b style={{ left: at(median) }} />
      </div>
      <dl className="bullet-key">
        {(
          [
            ['Min', min],
            ['Q1', q1],
            ['Median', median],
            ['Q3', q3],
            ['Max', max],
          ] as const
        ).map(([name, v]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{format(v)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}
