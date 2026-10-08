/**
 * A monthly share on a shared time axis, with the AI Act's milestones as numbered lines. Used by
 * the job-ad view and the AI governance timeline, where several panels share one x-axis but
 * each keeps its own y-scale (small multiples, never two scales in one chart).
 */
import { useRef, useState } from 'react'
import { l } from '../i18n'
import { fmtDate, pick } from './shared'
import type { Milestone } from './types'

/** The milestones drawn on the charts: the Act's main dates, in order. */
export const CHART_MILESTONES = new Set([
  'document-52021pc0206',
  'document-32024r1689',
  'prohibitions-and-literacy',
  'gpai-governance-penalties',
  'document-32026r1744',
  'general-application',
])

export type SeriesPoint = {
  month: string
  numerator: number
  denominator: number
  value: number
}

export const sharePct = (v: number, digits = 1) =>
  `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`

/** A round top for the y-axis: the next of 1, 2, 2.5, 5 × 10^k above the maximum. */
export function niceTop(max: number): number {
  if (max <= 0) return 0.001
  const exp = Math.floor(Math.log10(max))
  for (const step of [1, 2, 2.5, 5, 10]) {
    const top = step * 10 ** exp
    if (top >= max) return top
  }
  return 10 ** (exp + 1)
}

export function chartMilestones(timeline: Milestone[], last: string) {
  return timeline
    .filter(
      (m) => CHART_MILESTONES.has(m.milestone_id) && m.date.slice(0, 7) <= last,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function TimePanel({
  label,
  points,
  domain,
  milestones,
  numbered = true,
  height = 180,
  digits = 2,
  numeratorWord,
  denominatorWord,
  note,
}: {
  label: string
  points: SeriesPoint[]
  domain: [string, string]
  milestones: Milestone[]
  numbered?: boolean
  height?: number
  digits?: number
  numeratorWord: string
  denominatorWord: string
  note?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const t0 = Date.parse(`${domain[0]}-01`)
  const t1 = Date.parse(`${domain[1]}-01`)
  const x = (month: string) =>
    ((Date.parse(`${month.slice(0, 7)}-01`) - t0) / (t1 - t0)) * 100
  const top = niceTop(Math.max(0, ...points.map((p) => p.value)))
  const y = (v: number) => 100 - (v / top) * 100
  const ticks = [0, top / 2, top]
  // Enough decimals that the middle tick differs from zero (shares can be thousandths of a percent).
  const tickDigits = Math.max(
    digits,
    Math.ceil(-Math.log10((top * 100) / 2)) + 1,
  )
  const path = points
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${x(p.month).toFixed(2)},${y(p.value).toFixed(2)}`,
    )
    .join(' ')
  const years = [
    ...new Set(
      Array.from(
        {
          length:
            Number(domain[1].slice(0, 4)) - Number(domain[0].slice(0, 4)) + 1,
        },
        (_, i) => String(Number(domain[0].slice(0, 4)) + i),
      ),
    ),
  ].filter((yr) => `${yr}-01` >= domain[0])
  const point = hover != null ? points[hover] : null
  const last = points[points.length - 1]
  return (
    <figure
      className="aa-line-figure aa-panel"
      style={{ gridTemplateRows: `auto ${height}px auto` }}
    >
      <figcaption className="aa-panel-title">
        {label}
        {note && <span className="aa-muted">, {note}</span>}
      </figcaption>
      <div className="aa-line-y" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ top: `${y(t)}%` }}>
            {sharePct(t, tickDigits)}
          </span>
        ))}
      </div>
      <div
        className="aa-line-plot"
        ref={box}
        onMouseMove={(e) => {
          if (!points.length) return
          const r = box.current!.getBoundingClientRect()
          const at = ((e.clientX - r.left) / r.width) * (t1 - t0) + t0
          let best = 0
          points.forEach((p, i) => {
            if (
              Math.abs(Date.parse(`${p.month}-01`) - at) <
              Math.abs(Date.parse(`${points[best].month}-01`) - at)
            )
              best = i
          })
          setHover(best)
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            last
              ? l(
                  `${label}, ${points[0].month} to ${last.month}; ${sharePct(last.value, digits)} at the end.`,
                  `${label}, ${points[0].month} till ${last.month}; ${sharePct(last.value, digits)} i slutet.`,
                )
              : label
          }
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1="0"
              x2="100"
              y1={y(t)}
              y2={y(t)}
              className="aa-grid"
            />
          ))}
          {points.length > 0 && x(points[0].month) > 0.5 && (
            <rect
              x="0"
              y="0"
              width={x(points[0].month)}
              height="100"
              className="aa-nodata"
            />
          )}
          {milestones.map((m) => (
            <line
              key={m.milestone_id}
              x1={x(m.date)}
              x2={x(m.date)}
              y1="0"
              y2="100"
              className="aa-milestone-line"
            />
          ))}
          <path d={path} className="aa-line" />
          {point && (
            <line
              x1={x(point.month)}
              x2={x(point.month)}
              y1="0"
              y2="100"
              className="aa-crosshair"
            />
          )}
        </svg>
        {numbered &&
          milestones.map((m, i) => {
            const crowded = i > 0 && x(m.date) - x(milestones[i - 1].date) < 2.5
            return (
              <span
                key={m.milestone_id}
                className={`aa-milestone-tag${crowded ? ' is-raised' : ''}`}
                style={{ left: `${x(m.date)}%` }}
              >
                {i + 1}
              </span>
            )
          })}
        {point && (
          <span
            className="aa-dot"
            style={{ left: `${x(point.month)}%`, top: `${y(point.value)}%` }}
          />
        )}
        {point && (
          <div
            className="aa-tooltip"
            style={{ left: `${Math.min(70, Math.max(2, x(point.month)))}%` }}
            role="status"
          >
            <strong>{point.month}</strong>
            <span>
              {sharePct(point.value, digits)} {l('(3 months)', '(3 mån)')}
            </span>
            <span>
              {point.numerator.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
              {numeratorWord} {l('of', 'av')}{' '}
              {point.denominator.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
              {denominatorWord} {l('this month', 'denna månad')}
            </span>
          </div>
        )}
      </div>
      <div className="aa-line-x" aria-hidden="true">
        {years.map((yr) => (
          <span key={yr} style={{ left: `${x(`${yr}-01`)}%` }}>
            {yr}
          </span>
        ))}
      </div>
    </figure>
  )
}

export function MilestoneKey({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="aa-milestone-key">
      {milestones.map((m, i) => (
        <li key={m.milestone_id}>
          <b>{i + 1}</b> {fmtDate(m.date, true)}:{' '}
          {pick({ en: m.title_en, sv: m.title_sv })}
        </li>
      ))}
    </ol>
  )
}
