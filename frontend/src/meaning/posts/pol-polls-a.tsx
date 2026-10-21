/** SCB party preference survey, 1972 onward. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  band,
  every,
  Legend,
  line,
  pc,
  PARTIES,
  sum,
  uniq,
  XTicks,
  YGrid,
} from './pol-kit'

type Poll = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
  change_since_last_survey_pp: number | null
}
type Polls = { polls: Poll[] }

const usePolls = () => useData<Polls>('parliament/polls.json')
const months = (d: Polls) => uniq(d.polls.map((p) => p.survey_month)).sort()
const years = (ms: string[]) => uniq(ms.map((m) => m.slice(0, 4)))
const latest = (d: Polls) => {
  const m = months(d).at(-1)
  return d.polls.filter(
    (p) => p.survey_month === m && PARTIES.includes(p.party as never),
  )
}
const series = (d: Polls, ms: string[], p: string) => {
  const by = new Map(
    d.polls
      .filter((r) => r.party === p)
      .map((r) => [r.survey_month, r.share_pct]),
  )
  return ms.map((m) => by.get(m) ?? 0)
}

function Lines() {
  const data = usePolls()
  const [focus, setFocus] = useState<string>('SD')
  return (
    <Frame data={data}>
      {(d) => {
        const ms = months(d)
        const x = linearScale([0, ms.length - 1], [28, 632])
        const y = linearScale([0, 55], [172, 6])
        const ticks = every(years(ms), 6).map((yr) => ({
          x: x(ms.findIndex((m) => m.startsWith(yr))),
          label: yr,
        }))
        return (
          <>
            <Slicer
              label="Party"
              options={PARTIES}
              value={focus}
              onChange={setFocus}
            />
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label="Poll share by party over time"
            >
              <YGrid ticks={[0, 10, 20, 30, 40, 50]} x0={28} x1={632} y={y} />
              {[...PARTIES.filter((p) => p !== focus), focus].map((p) => {
                const rows = d.polls.filter((r) => r.party === p)
                const pts = rows.map(
                  (r) =>
                    [x(ms.indexOf(r.survey_month)), y(r.share_pct)] as [
                      number,
                      number,
                    ],
                )
                return (
                  <path
                    key={p}
                    d={line(pts)}
                    fill="none"
                    stroke={pc(p)}
                    strokeWidth={p === focus ? 3 : 1.2}
                    opacity={p === focus ? 1 : 0.45}
                  >
                    <title>{p}</title>
                  </path>
                )
              })}
              <XTicks y={186} ticks={ticks} />
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

function Stream() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const ms = months(d)
        const x = linearScale([0, ms.length - 1], [0, 640])
        const y = linearScale([-60, 60], [190, 0])
        const rows = PARTIES.map((p) => series(d, ms, p))
        let base = ms.map((_, i) => -sum(rows.map((r) => r[i])) / 2)
        return (
          <>
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label="Poll share as a streamgraph"
            >
              {PARTIES.map((p, k) => {
                const top = base.map((b, i) => b + rows[k][i])
                const path = band(
                  top.map((v, i) => [x(i), y(v)]),
                  base.map((v, i) => [x(i), y(v)]),
                )
                base = top
                return (
                  <path key={p} d={path} fill={pc(p)}>
                    <title>{p}</title>
                  </path>
                )
              })}
            </svg>
            <Legend items={[...PARTIES]} />
          </>
        )
      }}
    </Frame>
  )
}

function Heat() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const ys = years(months(d))
        const avg = (p: string, yr: string) => {
          const v = d.polls
            .filter((r) => r.party === p && r.survey_month.startsWith(yr))
            .map((r) => r.share_pct)
          return v.length ? sum(v) / v.length : null
        }
        const cw = 612 / ys.length
        return (
          <svg
            viewBox="0 0 640 190"
            role="img"
            aria-label="Average poll share per party and year, heatmap"
          >
            {PARTIES.map((p, r) => (
              <g key={p}>
                <text x={0} y={r * 21 + 14} className="mean-pol-t">
                  {p}
                </text>
                {ys.map((yr, c) => {
                  const v = avg(p, yr)
                  return v === null ? null : (
                    <rect
                      key={yr}
                      x={26 + c * cw}
                      y={r * 21}
                      width={cw - 1}
                      height={19}
                      rx={2}
                      fill={pc(p)}
                      opacity={0.1 + Math.min(v / 40, 1) * 0.9}
                    >
                      <title>{`${p} ${yr}: ${v.toFixed(1)}%`}</title>
                    </rect>
                  )
                })}
              </g>
            ))}
            <XTicks
              y={186}
              ticks={every(ys, 8).map((yr) => ({
                x: 26 + ys.indexOf(yr) * cw + cw / 2,
                label: yr,
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

function ErrorBars() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const ps = latest(d).sort((a, b) => b.share_pct - a.share_pct)
        const ticks = niceTicks(Math.max(...ps.map((p) => p.share_pct)) + 2)
        const y = linearScale([0, ticks.at(-1)!], [196, 10])
        return (
          <svg
            viewBox="0 0 300 214"
            role="img"
            aria-label="Latest poll with margins of error"
          >
            <YGrid ticks={ticks} x0={24} x1={296} y={y} />
            {ps.map((p, i) => {
              const cx = 44 + i * 33
              const e = p.margin_of_error_pp ?? 0
              return (
                <g key={p.party}>
                  <rect
                    x={cx - 11}
                    y={y(p.share_pct)}
                    width={22}
                    height={y(0) - y(p.share_pct)}
                    rx={3}
                    fill={pc(p.party)}
                  />
                  <path
                    d={`M${cx},${y(p.share_pct + e)}V${y(p.share_pct - e)}M${cx - 5},${y(p.share_pct + e)}h10M${cx - 5},${y(p.share_pct - e)}h10`}
                    stroke="var(--ink)"
                    strokeWidth={1}
                  />
                  <text
                    x={cx}
                    y={210}
                    textAnchor="middle"
                    className="mean-pol-t"
                  >
                    {p.party}
                  </text>
                  <title>{`${p.party} ${p.share_pct}% ± ${e}`}</title>
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-poll-lines',
    domain: 'politics',
    size: 'wide',
    render: () => <Lines />,
  },
  { id: 'pol-poll-error', domain: 'politics', render: () => <ErrorBars /> },
  {
    id: 'pol-poll-stream',
    domain: 'politics',
    size: 'wide',
    render: () => <Stream />,
  },
  {
    id: 'pol-poll-heat',
    domain: 'politics',
    size: 'wide',
    render: () => <Heat />,
  },
]
