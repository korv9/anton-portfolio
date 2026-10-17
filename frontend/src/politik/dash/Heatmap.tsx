/**
 * A compact heat table: rows × party columns, each cell shaded by its value on one neutral
 * scale and the number written in it. Easier to compare many parties at once than lines.
 */
import { identity, partyName } from '../../parties/identity'

const Code = ({ party }: { party: string }) => (
  <abbr
    title={partyName(party)}
    className="heat-party"
    style={{ borderBottomColor: identity(party).color }}
  >
    {party}
  </abbr>
)

export default function Heatmap({
  rows,
  parties,
  value,
  format,
  caption,
  max,
  min,
  rowHeader,
}: {
  rows: { key: string; label: string }[]
  parties: string[]
  value: (row: string, party: string) => number | null | undefined
  format: (v: number) => string
  caption: string
  /** The value that gets the darkest shade. */
  max?: number
  /** A fixed lower bound when comparisons must keep the same scale. */
  min?: number
  /** Party rows (a party × party table) show the party tag instead of a label. */
  rowHeader?: 'party'
}) {
  const values = rows.flatMap((r) =>
    parties.map((p) => value(r.key, p) ?? null),
  )
  const top = max ?? Math.max(...values.map((v) => v ?? 0), 1)
  const low =
    min ?? Math.min(...values.filter((v): v is number => v != null), top)
  return (
    <table className="dash-heat">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <td />
          {parties.map((p) => (
            <th key={p} scope="col">
              <Code party={p} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key} style={{ ['--i' as string]: i }}>
            <th scope="row" title={row.label}>
              {rowHeader === 'party' ? <Code party={row.key} /> : row.label}
            </th>
            {parties.map((p) => {
              const v = value(row.key, p)
              if (v == null) return <td key={p} className="empty" />
              // Fixed scales use a continuous pale ramp so every value keeps dark text.
              const t =
                top > low
                  ? Math.min(1, Math.max(0, (v - low) / (top - low)))
                  : 1
              const dark = t >= 0.5
              const alpha =
                min != null
                  ? 0.04 + t * 0.26
                  : dark
                    ? 0.9 + (t - 0.5) * 0.2
                    : 0.05 + t * 0.5
              return (
                <td
                  key={p}
                  style={{
                    background: `color-mix(in srgb, var(--ink) ${(alpha * 100).toFixed(1)}%, var(--paper))`,
                    color:
                      min != null
                        ? 'var(--ink)'
                        : dark
                          ? 'var(--on-accent)'
                          : undefined,
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
