/**
 * Stacked shares for the long read, built in HTML like the ranked bars so labels wrap on a phone
 * and every number is written out: parts of a whole per row, 100 % wide.
 */
import type { ReactNode } from 'react'
import './charts.css'

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
