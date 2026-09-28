/**
 * A compact line chart that fills its card: one line per party in the party's colour, marker
 * and line style, the party's letters at the line's end, and the chosen party drawn over the
 * others. Lines draw themselves in when they first appear. Hovering shows the values at the
 * nearest date.
 */
import { useMemo, useState } from 'react'
import { identity, partyDash } from '../../parties/identity'
import { MarkerShape, spreadLabels } from '../../charts/marks'
import { useSize } from './motion'

export type MiniSeries = {
  party: string
  points: { date: string; value: number; label: string }[]
}

const PAD = { top: 10, right: 34, bottom: 20, left: 34 }
const time = (d: string) => Date.parse(d)

export default function MiniLines({
  series,
  focus,
  format,
  label,
}: {
  series: MiniSeries[]
  focus: string | null
  format: (v: number) => string
  label: string
}) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.points)
  const dates = useMemo(
    () => [...new Set(all.map((p) => p.date))].sort(),
    [all.length, series],
  )
  const w = Math.max(width, 10)
  const h = Math.max(height, 10)
  const t0 = time(dates[0] ?? '2000-01-01')
  const t1 = time(dates.at(-1) ?? '2001-01-01')
  const max = Math.max(...all.map((p) => p.value), 1)
  const top = Math.ceil(max / 10) * 10
  const x = (d: string) =>
    PAD.left +
    ((time(d) - t0) / Math.max(t1 - t0, 1)) * (w - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / top) * (h - PAD.top - PAD.bottom)
  const ticks = [0, top / 2, top]
  const years = [
    ...new Set(
      dates
        .map((d) => d.slice(0, 4))
        .filter((_, i, a) => i === 0 || i === a.length - 1),
    ),
  ]
  // The chosen party is drawn last, so it lies on top.
  const ordered = [...series].sort(
    (a, b) => Number(a.party === focus) - Number(b.party === focus),
  )
  const hoverDate = hover == null ? null : dates[hover]
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - box.left
    let best = 0
    dates.forEach((d, i) => {
      if (Math.abs(x(d) - px) < Math.abs(x(dates[best]) - px)) best = i
    })
    setHover(best)
  }

  return (
    <div className="mini-lines" ref={ref}>
      {width > 0 && dates.length > 0 && (
        <svg
          width={w}
          height={h}
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={w - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="mini-grid"
              />
              <text
                x={PAD.left - 6}
                y={y(t) + 3}
                textAnchor="end"
                className="mini-axis"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {years.map((yr, i) => (
            <text
              key={yr}
              x={i === 0 ? PAD.left : w - PAD.right}
              y={h - 5}
              textAnchor={i === 0 ? 'start' : 'end'}
              className="mini-axis"
            >
              {yr}
            </text>
          ))}
          {ordered.map((s) => {
            const p = identity(s.party)
            const dim = focus != null && s.party !== focus
            const d = s.points
              .map((pt) => `${x(pt.date)},${y(pt.value)}`)
              .join(' ')
            return (
              <g
                key={s.party}
                className={dim ? 'mini-series dim' : 'mini-series'}
              >
                {p.casing && (
                  <polyline
                    points={d}
                    fill="none"
                    stroke={p.casing}
                    strokeWidth={s.party === focus ? 5 : 3.5}
                    pathLength={1}
                    className="mini-draw"
                  />
                )}
                <polyline
                  points={d}
                  fill="none"
                  stroke={p.line}
                  strokeWidth={s.party === focus ? 3 : 1.75}
                  strokeLinejoin="round"
                  strokeDasharray={partyDash(s.party)}
                  pathLength={partyDash(s.party) ? undefined : 1}
                  className={partyDash(s.party) ? 'mini-fade' : 'mini-draw'}
                />
              </g>
            )
          })}
          {spreadLabels(
            series
              .filter((s) => s.points.length)
              .map((s) => ({
                party: s.party,
                x: x(s.points.at(-1)!.date),
                y: y(s.points.at(-1)!.value),
              })),
            11,
            PAD.top,
            h - PAD.bottom,
          ).map((l) => (
            <g
              key={l.party}
              className={
                focus != null && l.party !== focus
                  ? 'mini-series dim'
                  : 'mini-series'
              }
            >
              <MarkerShape
                shape={identity(l.party).marker}
                x={l.x}
                y={l.y}
                size={3}
                fill={identity(l.party).line}
                stroke={identity(l.party).casing ?? '#fff'}
              />
              <text x={l.x + 7} y={l.labelY + 3.5} className="mini-end">
                {l.party}
              </text>
            </g>
          ))}
          {hoverDate && (
            <line
              x1={x(hoverDate)}
              x2={x(hoverDate)}
              y1={PAD.top}
              y2={h - PAD.bottom}
              className="mini-cross"
            />
          )}
        </svg>
      )}
      {hoverDate && (
        <div
          className="mini-tip"
          style={
            x(hoverDate) > w * 0.6
              ? { right: w - x(hoverDate) + 8 }
              : { left: x(hoverDate) + 8 }
          }
          role="status"
        >
          <strong>
            {series[0]?.points.find((p) => p.date === hoverDate)?.label}
          </strong>
          {[...series]
            .map((s) => ({
              s,
              p: s.points.find((pt) => pt.date === hoverDate),
            }))
            .filter((r) => r.p)
            .sort((a, b) => b.p!.value - a.p!.value)
            .map(({ s, p }) => (
              <span
                key={s.party}
                className={focus === s.party ? 'on' : undefined}
              >
                <i style={{ background: identity(s.party).line }} />
                {s.party} {format(p!.value)}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
