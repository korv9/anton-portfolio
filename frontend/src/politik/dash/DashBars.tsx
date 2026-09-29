/**
 * Compact horizontal bars for a dashboard card. Bars grow in when shown and glide to their new
 * length when the data change (another party chosen). Diverging around zero when any value is
 * negative. A bar takes a party's colour only when it stands for a party.
 */
import { identity } from '../../parties/identity'

export type DashBar = {
  key: string
  label: string
  value: number
  party?: string
  /** Colour for a bar that is not a party (neutral by default). */
  tone?: 'neutral' | 'muted'
  /** An earlier value, drawn as a tick on the track (e.g. the previous survey). */
  ref?: number | null
  /** A short note after the value, e.g. the change since the earlier value. */
  note?: string
}

export default function DashBars({
  bars,
  format,
  label,
  max: fixedMax,
}: {
  bars: DashBar[]
  format: (v: number) => string
  label: string
  /** A fixed scale, e.g. 100 for percentages, so bars compare across parties. */
  max?: number
}) {
  const max = fixedMax ?? Math.max(...bars.map((b) => Math.abs(b.value)), 1)
  const diverging = bars.some((b) => b.value < 0)
  return (
    <ol
      className={diverging ? 'dash-bars diverging' : 'dash-bars'}
      aria-label={label}
    >
      {bars.map((bar, i) => {
        const p = bar.party ? identity(bar.party) : null
        const width = (Math.abs(bar.value) / max) * (diverging ? 50 : 100)
        return (
          <li key={bar.key} style={{ ['--i' as string]: i }}>
            <span className="dash-bar-label" title={bar.label}>
              {bar.label}
            </span>
            <span className="dash-bar-track" aria-hidden="true">
              <i
                className={bar.value < 0 ? 'neg' : undefined}
                style={{
                  left: diverging
                    ? bar.value < 0
                      ? `${50 - width}%`
                      : '50%'
                    : 0,
                  width: `${width}%`,
                  background: p
                    ? p.color
                    : bar.tone === 'muted'
                      ? '#9a9a9a'
                      : '#2b2b2b',
                  outline: p?.casing ? `1px solid ${p.casing}` : undefined,
                  outlineOffset: -1,
                }}
              />
              {bar.ref != null && !diverging && (
                <b
                  className="dash-bar-ref"
                  style={{ left: `${(bar.ref / max) * 100}%` }}
                />
              )}
            </span>
            <span className="dash-bar-value">
              {format(bar.value)}
              {bar.note && <small>{bar.note}</small>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
