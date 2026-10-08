/**
 * The site's one bar chart: categories ranked as horizontal bars, the label on the left and
 * the number written out on the right, so the value never rests on length alone. It diverges
 * around zero when any value is negative. A bar takes a party's colour only when it stands for
 * that party; everything else is one neutral ink. A picked row stays dark and the rest fade.
 * Long lists show the first `limit` rows and a button for the rest. Built in HTML, not SVG,
 * so labels wrap on a phone.
 */
import { useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { identity, partyFill } from '../parties/identity'
import './charts.css'

export type RankRow = {
  key: string
  label: ReactNode
  value: number
  /** Shown instead of the formatted value. */
  text?: string
  /** A party code: the bar is drawn in the party's colour. */
  party?: string
  /** A colour that carries meaning of its own (a series, a status). */
  color?: string
  /** A short note after the value, e.g. the change since an earlier value. */
  note?: string
  /** An earlier value, drawn as a tick on the track (e.g. the previous survey). */
  ref?: number | null
  /** A second, thinner bar under the first (e.g. disagreement under volume). */
  second?: number
}

export default function RankBars({
  rows,
  format,
  label,
  max,
  secondMax,
  limit,
  onPick,
  picked,
}: {
  rows: RankRow[]
  format: (value: number) => string
  /** What the chart shows, for screen readers. */
  label: string
  /** A fixed scale, e.g. 100 for percentages, so bars compare across charts. */
  max?: number
  secondMax?: number
  /** Show this many rows and a button for the rest. */
  limit?: number
  onPick?: (key: string) => void
  picked?: string | null
}) {
  const [all, setAll] = useState(false)
  const top = max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  const diverging = rows.some((r) => r.value < 0)
  const shown = limit && !all ? rows.slice(0, limit) : rows
  return (
    <figure className="rank-bars" aria-label={label}>
      <ol
        className={[
          'rank-bars-list',
          diverging && 'diverging',
          picked && 'has-pick',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {shown.map((r) => {
          const p = r.party ? identity(r.party) : null
          const width = (Math.abs(r.value) / top) * (diverging ? 50 : 100)
          const left = diverging ? (r.value < 0 ? 50 - width : 50) : 0
          const body = (
            <>
              <span className="rank-label">{r.label}</span>
              <span className="rank-track" aria-hidden="true">
                <i
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, r.value === 0 ? 0 : 0.4)}%`,
                    background:
                      r.color ?? (r.party ? partyFill(r.party) : undefined),
                    outline: p?.casing ? `1px solid ${p.casing}` : undefined,
                    outlineOffset: -1,
                  }}
                />
                {r.ref != null && !diverging && (
                  <b
                    className="rank-ref"
                    style={{ left: `${(r.ref / top) * 100}%` }}
                  />
                )}
                {r.second != null && secondMax ? (
                  <u
                    className="rank-second"
                    style={{ width: `${(r.second / secondMax) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="rank-value">
                {r.text ?? format(r.value)}
                {r.note && <small>{r.note}</small>}
              </span>
            </>
          )
          return (
            <li key={r.key} className={picked === r.key ? 'picked' : undefined}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(r.key)}
                  aria-pressed={picked === r.key}
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ol>
      {limit && rows.length > limit && (
        <button
          type="button"
          className="btn-text rank-more"
          onClick={() => setAll(!all)}
          aria-expanded={all}
        >
          {all
            ? l('Show fewer', 'Visa färre')
            : l(`Show all ${rows.length}`, `Visa alla ${rows.length}`)}
        </button>
      )}
    </figure>
  )
}
