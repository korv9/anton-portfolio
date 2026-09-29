/**
 * Grouped horizontal bars: one row per category (an expenditure area), one bar per party in
 * the party's colour, diverging around zero when any value is negative. Several parties can
 * be read against each other on the same scale; the value is written at the end of each bar.
 */
import { identity, partyName } from '../../parties/identity'

export type Group = {
  key: string
  label: string
  values: { party: string; value: number | null }[]
}

export default function GroupedBars({
  groups,
  format,
  label,
}: {
  groups: Group[]
  format: (v: number) => string
  label: string
}) {
  const all = groups.flatMap((g) => g.values.map((v) => v.value ?? 0))
  const max = Math.max(...all.map(Math.abs), 1)
  const diverging = all.some((v) => v < 0)
  const many = (groups[0]?.values.length ?? 0) > 1
  return (
    <ol
      className={`grouped${diverging ? ' diverging' : ''}${many ? ' many' : ''}`}
      aria-label={label}
    >
      {groups.map((group, i) => (
        <li key={group.key} style={{ ['--i' as string]: i }}>
          <span className="grouped-label" title={group.label}>
            {group.label}
          </span>
          <span className="grouped-bars">
            {group.values.map(({ party, value }) => {
              const p = identity(party)
              const v = value ?? 0
              const width = (Math.abs(v) / max) * (diverging ? 50 : 100)
              return (
                <span
                  key={party}
                  className="grouped-row"
                  title={`${partyName(party)}: ${value == null ? '–' : format(v)}`}
                >
                  <span className="grouped-track" aria-hidden="true">
                    <i
                      className={v < 0 ? 'neg' : undefined}
                      style={{
                        left: diverging
                          ? v < 0
                            ? `${50 - width}%`
                            : '50%'
                          : 0,
                        width: `${width}%`,
                        background: p.color,
                        outline: p.casing ? `1px solid ${p.casing}` : undefined,
                        outlineOffset: -1,
                      }}
                    />
                  </span>
                  <span className="grouped-value">
                    {many && <b>{party}</b>}
                    {value == null ? '–' : format(v)}
                  </span>
                </span>
              )
            })}
          </span>
        </li>
      ))}
    </ol>
  )
}
