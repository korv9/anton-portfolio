/**
 * Horizontal bars with the label on the left and the value written out, diverging around
 * zero when any value is negative. Built in HTML rather than SVG so labels stay readable and
 * wrap on a phone. A bar takes a party's colour only when it stands for that party.
 */
import { identity } from '../parties/identity'

export type Bar = {
  key: string
  label: string
  value: number
  /** A party code: the bar is drawn in the party's colour, with its letters in the label. */
  party?: string
  /** A short note after the value, e.g. the change since an earlier value. */
  note?: string
}

export default function Bars({
  bars,
  format,
  description,
  neutral = '#4a4a4a',
}: {
  bars: Bar[]
  format: (value: number) => string
  /** What the chart shows, for screen readers. */
  description: string
  neutral?: string
}) {
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1)
  const diverging = bars.some((b) => b.value < 0)
  return (
    <figure className="bars" aria-label={description}>
      <ol className={diverging ? 'bars-list diverging' : 'bars-list'}>
        {bars.map((bar) => {
          const p = bar.party ? identity(bar.party) : null
          const width = (Math.abs(bar.value) / max) * (diverging ? 50 : 100)
          const left = diverging ? (bar.value < 0 ? 50 - width : 50) : 0
          return (
            <li key={bar.key}>
              <span className="bars-label">{bar.label}</span>
              <span className="bars-track" aria-hidden="true">
                <i
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, bar.value === 0 ? 0 : 0.4)}%`,
                    background: p ? p.color : neutral,
                    outline: p?.casing ? `1px solid ${p.casing}` : undefined,
                    outlineOffset: -1,
                  }}
                />
              </span>
              <span className="bars-value">
                {format(bar.value)}
                {bar.note && <small>{bar.note}</small>}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
