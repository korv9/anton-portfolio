/**
 * What the parties talk about, compared with before: for each issue area a group of columns,
 * one per party in its colour, the share of that party's speaking that went to the area. A
 * dashed frame behind each column is the same share in the earlier period (the previous
 * riksmöte, or the previous debate), so a rise or a fall shows at a glance.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { identity, partyName } from '../../parties/identity'
import { num } from '../controls'

export type TopicRow = { key: string; label: string }

export default function TopicBars({
  rows,
  parties,
  value,
  previous,
  previousLabel,
  unit,
}: {
  rows: TopicRow[]
  parties: string[]
  /** Share (0–100) of the party's speaking that went to the row's area, or null. */
  value: (row: string, party: string) => number | null
  previous?: (row: string, party: string) => number | null
  /** What the dashed frames show, e.g. "2024/25". */
  previousLabel?: string
  unit: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(
    1,
    ...rows.flatMap((r) =>
      parties.flatMap((p) => [value(r.key, p) ?? 0, previous?.(r.key, p) ?? 0]),
    ),
  )
  const describe = (row: TopicRow, party: string) => {
    const now = value(row.key, party)
    const before = previous?.(row.key, party)
    return `${partyName(party)}, ${row.label}: ${now == null ? '–' : `${num(now, 1)} ${unit}`}${
      before != null && previousLabel
        ? ` (${previousLabel}: ${num(before, 1)} ${unit})`
        : ''
    }`
  }
  return (
    <div className="topic-bars">
      <ul className="topic-legend" aria-label={l('Parties', 'Partier')}>
        {parties.map((p) => (
          <li key={p}>
            <i style={{ background: identity(p).color }} />
            {p}
          </li>
        ))}
        {previous && previousLabel && (
          <li className="topic-legend-prev">
            <i />
            {previousLabel}
          </li>
        )}
      </ul>
      <div className="topic-scroll">
        <ol
          className="topic-groups"
          style={{ ['--n' as string]: parties.length }}
        >
          {rows.map((row) => (
            <li key={row.key}>
              <div className="topic-columns">
                {parties.map((party, i) => {
                  const now = value(row.key, party) ?? 0
                  const before = previous?.(row.key, party)
                  const id = `${row.key}-${party}`
                  return (
                    <span
                      key={party}
                      className={`topic-col${hover && hover !== id ? ' dim' : ''}`}
                      title={describe(row, party)}
                      aria-label={describe(row, party)}
                      role="img"
                      tabIndex={0}
                      onMouseEnter={() => setHover(id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(id)}
                      onBlur={() => setHover(null)}
                      style={{ ['--i' as string]: i }}
                    >
                      {before != null && (
                        <b
                          className="topic-prev"
                          style={{ height: `${(before / max) * 100}%` }}
                        />
                      )}
                      <i
                        style={{
                          height: `${(now / max) * 100}%`,
                          background: identity(party).color,
                        }}
                      />
                    </span>
                  )
                })}
              </div>
              <span className="topic-label">{row.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="topic-readout" aria-live="polite">
        {hover
          ? (() => {
              const [rowKey, party] = [
                hover.slice(0, hover.lastIndexOf('-')),
                hover.slice(hover.lastIndexOf('-') + 1),
              ]
              const row = rows.find((r) => r.key === rowKey)
              return row ? describe(row, party) : ''
            })()
          : l(
              'Hover a column for the figure. The dashed frame is the earlier period.',
              'Hovra över en stapel för siffran. Den streckade ramen är den tidigare perioden.',
            )}
      </p>
    </div>
  )
}
