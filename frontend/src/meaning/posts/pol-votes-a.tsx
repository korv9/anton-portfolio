/** Riksdag roll calls per session since 1993/94: attendance, cohesion, agreement. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { arc, every, pc, PARTIES, XTicks, YGrid } from './pol-kit'

type Session = {
  session: string
  roll_calls: number
  government_key: string
  government_parties: string[]
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

const useSessions = () => useData<Sessions>('parliament/sessions.json')
const short = (s: string) => s.slice(2)
const recentFirst = (d: Sessions) => d.sessions.map((s) => s.session).reverse()

function Lollipop() {
  return (
    <Frame data={useSessions()}>
      {(d) => {
        const ticks = niceTicks(
          Math.max(...d.sessions.map((s) => s.roll_calls)),
        )
        const y = linearScale([0, ticks.at(-1)!], [172, 8])
        const x = linearScale([0, d.sessions.length - 1], [40, 628])
        return (
          <svg
            viewBox="0 0 640 190"
            role="img"
            aria-label="Roll calls per session"
          >
            <YGrid ticks={ticks} x0={36} x1={632} y={y} />
            {d.sessions.map((s, i) => (
              <g
                key={s.session}
                stroke={pc(s.government_parties[0])}
                fill={pc(s.government_parties[0])}
              >
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(0)}
                  y2={y(s.roll_calls)}
                  strokeWidth={2}
                />
                <circle cx={x(i)} cy={y(s.roll_calls)} r={5}>
                  <title>{`${s.session}: ${s.roll_calls}`}</title>
                </circle>
              </g>
            ))}
            <XTicks
              y={186}
              ticks={every(d.sessions, 4).map((s) => ({
                x: x(d.sessions.indexOf(s)),
                label: short(s.session),
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

function MetricHeat() {
  const data = useSessions()
  const [m, setM] = useState<Metric>('cohesion')
  return (
    <Frame data={data}>
      {(d) => {
        const ss = d.sessions.map((s) => s.session)
        const vals = d.party_record.map((r) => r[METRICS[m]])
        const lo = Math.min(...vals)
        const hi = Math.max(...vals)
        const cw = 610 / ss.length
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={METRIC_KEYS}
              value={m}
              onChange={setM}
            />
            <svg
              viewBox="0 0 640 200"
              role="img"
              aria-label={`Party ${m} per session, heatmap`}
            >
              {PARTIES.map((p, r) => (
                <g key={p}>
                  <text x={0} y={r * 22 + 15} className="mean-pol-t">
                    {p}
                  </text>
                  {d.party_record
                    .filter((q) => q.party === p)
                    .map((q) => (
                      <rect
                        key={q.session}
                        x={28 + ss.indexOf(q.session) * cw}
                        y={r * 22}
                        width={cw - 1}
                        height={20}
                        rx={2}
                        fill={pc(p)}
                        opacity={
                          0.08 + (0.92 * (q[METRICS[m]] - lo)) / (hi - lo || 1)
                        }
                      >
                        <title>{`${p} ${q.session}: ${q[METRICS[m]]}%`}</title>
                      </rect>
                    ))}
                </g>
              ))}
              <XTicks
                y={196}
                ticks={every(ss, 4).map((s) => ({
                  x: 28 + ss.indexOf(s) * cw + cw / 2,
                  label: short(s),
                }))}
              />
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

function Chord() {
  const data = useSessions()
  const [s, setS] = useState('2025/26')
  return (
    <Frame data={data}>
      {(d) => {
        const pairs = d.party_pairs.filter((p) => p.session === s)
        const ps: string[] = PARTIES.filter((p) =>
          pairs.some((q) => q.party_a === p || q.party_b === p),
        )
        const at = (p: string) => (ps.indexOf(p) / ps.length) * Math.PI * 2
        const pt = (a: number, r: number) => [
          150 + r * Math.sin(a),
          150 - r * Math.cos(a),
        ]
        return (
          <>
            <Slicer
              label="Session"
              options={every(recentFirst(d), 4)}
              value={s}
              onChange={setS}
            />
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label={`Voting agreement between parties, ${s}`}
            >
              {pairs.map((q) => {
                const [x1, y1] = pt(at(q.party_a), 112)
                const [x2, y2] = pt(at(q.party_b), 112)
                return (
                  <path
                    key={q.party_a + q.party_b}
                    d={`M${x1},${y1}Q150,150 ${x2},${y2}`}
                    fill="none"
                    stroke={pc(q.party_a)}
                    strokeWidth={(q.agreement_pct / 100) ** 3 * 14}
                    opacity={0.65}
                  >
                    <title>{`${q.party_a}–${q.party_b}: ${q.agreement_pct}%`}</title>
                  </path>
                )
              })}
              {ps.map((p) => {
                const a = at(p)
                const [tx, ty] = pt(a, 134)
                return (
                  <g key={p}>
                    <path
                      d={arc(150, 150, 114, 124, a - 0.3, a + 0.3)}
                      fill={pc(p)}
                    />
                    <text
                      x={tx}
                      y={ty + 3}
                      textAnchor="middle"
                      className="mean-pol-t"
                    >
                      {p}
                    </text>
                  </g>
                )
              })}
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
    render: () => <Lollipop />,
  },
  {
    id: 'pol-chord',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    render: () => <Chord />,
  },
  {
    id: 'pol-metric-heat',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    render: () => <MetricHeat />,
  },
]
