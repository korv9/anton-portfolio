/**
 * What the parties talked about: issue areas down the side, a party per column, and in each
 * cell a disc in the party's colour whose area is the share of that party's words that went to
 * the area. A ring behind the disc is the same share in the debate before, so a rise or a fall
 * shows as a disc outgrowing or shrinking inside its ring. The largest share in a row is
 * written out; every cell reads out its numbers on hover and to a screen reader.
 */
import { l } from '../../i18n'
import { PartyLogo, partyLine, partyName } from '../../parties/identity'
import { num } from '../controls'
import './topicMatrix.css'

export type TopicRow = { key: string; label: string }

export default function TopicMatrix({
  rows,
  parties,
  value,
  previous,
  previousLabel,
  unit,
}: {
  rows: TopicRow[]
  parties: string[]
  /** Share (0–100) of the party's words that went to the row's area, or null. */
  value: (row: string, party: string) => number | null
  previous?: (row: string, party: string) => number | null
  /** What the rings show, e.g. the date of the debate before. */
  previousLabel?: string
  unit: string
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) =>
      parties.flatMap((p) => [value(r.key, p) ?? 0, previous?.(r.key, p) ?? 0]),
    ),
  )
  // Area, not width, carries the share.
  const scale = (v: number) => ({ transform: `scale(${Math.sqrt(v / max)})` })
  return (
    <div
      className="topic-matrix"
      tabIndex={0}
      role="group"
      aria-label={l(
        'What each party talked about, by issue area',
        'Vad varje parti pratade om, per sakområde',
      )}
    >
      <table>
        <thead>
          <tr>
            <td />
            {parties.map((p) => (
              <th key={p} scope="col" title={partyName(p)}>
                <PartyLogo party={p} size={24} decorative={false} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const top = Math.max(...parties.map((p) => value(row.key, p) ?? 0))
            return (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {parties.map((p) => {
                  const now = value(row.key, p) ?? 0
                  const before = previous?.(row.key, p)
                  const text = `${partyName(p)}, ${row.label}: ${num(now, 1)} ${unit}${before != null ? `, ${previousLabel}: ${num(before, 1)} ${unit}` : ''}`
                  return (
                    <td key={p} title={text} aria-label={text}>
                      <span
                        className="topic-cell"
                        style={{ ['--c' as string]: partyLine(p) }}
                      >
                        {before != null && before > 0 && (
                          <i className="topic-ring" style={scale(before)} />
                        )}
                        <i className="topic-disc" style={scale(now)} />
                      </span>
                      <span
                        className={
                          now === top && now > 0 ? 'topic-n top' : 'topic-n'
                        }
                      >
                        <span aria-hidden="true">{num(now, 0)}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="topic-keys">
        <span className="topic-key disc">
          {l(
            `Share of the party’s words, ${unit}`,
            `Andel av partiets ord, ${unit}`,
          )}
        </span>
        {previousLabel && (
          <span className="topic-key ring">{previousLabel}</span>
        )}
      </p>
    </div>
  )
}
