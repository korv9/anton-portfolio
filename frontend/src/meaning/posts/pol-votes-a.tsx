/** Riksdag roll calls per session since 1993/94: attendance, cohesion, agreement. */
import { useState } from 'react'
import { focal, Frame, seq, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween, XAxis, YAxis } from '../axes'
import { best, every, fromEnd, GovStrip, int, PARTIES, Sub } from './pol-kit'

type Session = {
  session: string
  roll_calls: number
  government_key: string
  government_name: string
  government_parties: string[]
  start_year: number
}
type Record_ = {
  session: string
  party: string
  role: string
  attendance_pct: number
  cohesion_pct: number
  on_winning_side_pct: number
  with_government_pct: number
  abstained_pct: number
}
type Pair = {
  session: string
  party_a: string
  party_b: string
  agreement_pct: number
}
type Sessions = {
  sessions: Session[]
  party_record: Record_[]
  party_pairs: Pair[]
  government_record: {
    session: string
    decisions: number
    government_won_pct: number
  }[]
}

const METRICS = {
  attendance: 'attendance_pct',
  cohesion: 'cohesion_pct',
  winning: 'on_winning_side_pct',
  'with gov': 'with_government_pct',
  abstained: 'abstained_pct',
} as const
type Metric = keyof typeof METRICS
const METRIC_KEYS = Object.keys(METRICS) as Metric[]
const METRIC_NAMES: Record<Metric, string> = {
  attendance: 'Attendance, % of roll calls',
  cohesion: 'Party unity: members voting with their party, %',
  winning: 'On the winning side, %',
  'with gov': 'Voted with the government, %',
  abstained: 'Party abstained, % of roll calls',
}

const useSessions = () => useData<Sessions>('parliament/sessions.json')
/** A riksmöte runs from September to the next summer; until the next one opens it may still
 * be adding roll calls, so it is not compared with full sessions. */
const ongoing = (s: Session) => Date.now() < Date.UTC(s.start_year + 1, 8, 1)

/** Roll calls per session as plain columns, the latest full one in the accent, with the
 * government of each session named in grey bands underneath. A session still under way is
 * drawn faint. */
function Columns() {
  return (
    <Frame data={useSessions()}>
      {(d) => {
        const n = d.sessions.length
        if (!n) return null
        const lastFull = d.sessions.map((s) => !ongoing(s)).lastIndexOf(true)
        const [, hi] = niceDomain(
          0,
          Math.max(1, ...d.sessions.map((s) => s.roll_calls)),
        )
        const y = linearScale([0, hi], [150, 10])
        const step = 548 / n
        const x = (i: number) => 44 + step * (i + 0.5)
        return (
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label="Roll calls per session, with the government of each session"
          >
            <YAxis
              y={y}
              ticks={ticksBetween(0, hi)}
              x0={44}
              x1={592}
              format={int}
            />
            {d.sessions.map((s, i) => (
              <rect
                key={s.session}
                x={x(i) - step * 0.35}
                y={y(s.roll_calls)}
                width={step * 0.7}
                height={y(0) - y(s.roll_calls)}
                fill={focal(i === lastFull)}
                opacity={ongoing(s) ? 0.4 : 1}
              >
                <title>{`${s.session}: ${int(s.roll_calls)} roll calls${ongoing(s) ? ' so far (session under way)' : ''}`}</title>
              </rect>
            ))}
            <GovStrip sessions={d.sessions} x={x} step={step} y={156} />
            <XAxis
              y={194}
              x={x}
              ticks={every(
                d.sessions.map((_, i) => i),
                8,
              ).map((i) => ({ value: i, label: d.sessions[i].session }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

/** Sessions the heatmap shows: few enough that every cell can carry its number. */
const SHOWN = 8

/** Keeps one decimal from 99.5 to just under 100, so 99.6 is not rounded up to 100. */
const cell = (v: number) =>
  v >= 99.5 && v < 100 ? v.toFixed(1) : String(Math.round(v))

function MetricHeat() {
  const data = useSessions()
  const [m, setM] = useState<Metric>('with gov')
  return (
    <Frame data={data}>
      {(d) => {
        const ss = d.sessions.slice(-SHOWN).map((s) => s.session)
        const recs = d.party_record.filter((r) => ss.includes(r.session))
        const ps = PARTIES.filter((p) => recs.some((r) => r.party === p))
        if (!recs.length) return null
        const vals = recs.map((r) => r[METRICS[m]])
        const lo = Math.min(...vals)
        const hi = Math.max(...vals)
        const cw = 560 / ss.length
        const rh = 20
        return (
          <>
            <Slicer
              label="Measure"
              options={METRIC_KEYS}
              format={(k) => METRIC_NAMES[k]}
              value={m}
              onChange={setM}
            />
            <Sub>{METRIC_NAMES[m]}</Sub>
            <svg
              viewBox="0 0 600 196"
              role="img"
              aria-label={`${METRIC_NAMES[m]} per party, last ${SHOWN} sessions`}
            >
              {ps.map((p, r) => (
                <g key={p}>
                  <g className="mean-end">
                    <text x={0} y={r * (rh + 2) + 14}>
                      {p}
                    </text>
                  </g>
                  {recs
                    .filter((q) => q.party === p)
                    .map((q) => {
                      const v = q[METRICS[m]]
                      const t = (v - lo) / (hi - lo || 1)
                      const cx = 36 + ss.indexOf(q.session) * cw
                      return (
                        <g key={q.session}>
                          <rect
                            x={cx}
                            y={r * (rh + 2)}
                            width={cw - 2}
                            height={rh}
                            fill={seq(t)}
                          >
                            <title>{`${p} ${q.session}: ${v} %`}</title>
                          </rect>
                          <text
                            x={cx + cw / 2 - 1}
                            y={r * (rh + 2) + 14}
                            textAnchor="middle"
                            className="mean-pol-cellv"
                            style={
                              t > 0.55
                                ? { fill: 'var(--mean-card)' }
                                : undefined
                            }
                          >
                            {cell(v)}
                          </text>
                        </g>
                      )
                    })}
                </g>
              ))}
              <g className="mean-axis">
                {ss.map((s, i) => (
                  <text
                    key={s}
                    x={36 + i * cw + cw / 2 - 1}
                    y={ps.length * (rh + 2) + 12}
                    textAnchor="middle"
                  >
                    {s}
                  </text>
                ))}
              </g>
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-rollcall-lollipop',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    title: (d: Sessions) => {
      const top = best(
        d.sessions.filter((s) => !ongoing(s)),
        (s) => s.roll_calls,
      )
      return top
        ? `Roll calls per Riksdag session; ${top.session} had the most, ${int(top.roll_calls)}`
        : 'Roll calls per Riksdag session'
    },
    note: 'Recorded votes per session, with the government of the day. Source: Riksdagen.',
    render: () => <Columns />,
  },
  {
    id: 'pol-metric-heat',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    title: (d: Sessions) =>
      d.sessions.length
        ? `Party voting records, ${fromEnd(d.sessions, SHOWN).session}–${d.sessions.at(-1)!.session}`
        : 'Party voting records',
    note: 'Per party and session; the shade follows the value written in each cell. Source: Riksdagen roll calls.',
    render: () => <MetricHeat />,
  },
]
