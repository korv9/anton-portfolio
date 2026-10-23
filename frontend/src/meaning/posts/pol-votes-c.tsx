/** Riksdag roll calls per session since 1993/94: attendance, cohesion, agreement. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { every, Legend, line, pc, XTicks, YGrid } from './pol-kit'

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
const recentFirst = (d: Sessions) => d.sessions.map((s) => s.session).reverse()

function Parallel() {
  const data = useSessions()
  const [s, setS] = useState('2025/26')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d.party_record.filter((r) => r.session === s)
        const x = linearScale([0, METRIC_KEYS.length - 1], [40, 600])
        const y = linearScale([0, 100], [170, 14])
        return (
          <>
            <Slicer
              label="Session"
              options={every(recentFirst(d), 4)}
              value={s}
              onChange={setS}
            />
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label={`Party voting profile across five measures, ${s}`}
            >
              {METRIC_KEYS.map((m, i) => (
                <line
                  key={m}
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(0)}
                  y2={y(100)}
                  className="mean-pol-grid"
                />
              ))}
              {rows.map((r) => (
                <path
                  key={r.party}
                  d={line(METRIC_KEYS.map((m, i) => [x(i), y(r[METRICS[m]])]))}
                  fill="none"
                  stroke={pc(r.party)}
                  strokeWidth={2.5}
                  opacity={0.85}
                >
                  <title>{r.party}</title>
                </path>
              ))}
              <XTicks
                y={186}
                ticks={METRIC_KEYS.map((m, i) => ({ x: x(i), label: m }))}
              />
            </svg>
            <Legend items={rows.map((r) => r.party)} />
          </>
        )
      }}
    </Frame>
  )
}

function Scatter() {
  return (
    <Frame data={useSessions()}>
      {(d) => {
        const x = linearScale([0, 100], [28, 292])
        const y = linearScale([80, 100], [272, 8])
        return (
          <svg
            viewBox="0 0 300 290"
            role="img"
            aria-label="Cohesion against voting with the government, every party and session"
          >
            <YGrid ticks={[80, 90, 100]} x0={28} x1={292} y={y} />
            {d.party_record.map((r) => (
              <circle
                key={r.session + r.party}
                cx={x(r.with_government_pct)}
                cy={y(Math.max(80, r.cohesion_pct))}
                r={r.role === 'government' ? 5 : 3}
                fill={pc(r.party)}
                opacity={0.75}
              >
                <title>{`${r.party} ${r.session}`}</title>
              </circle>
            ))}
            <XTicks
              y={286}
              ticks={[0, 50, 100].map((v) => ({ x: x(v), label: `${v}%` }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-cohesion-scatter',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    render: () => <Scatter />,
  },
  {
    id: 'pol-parallel',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    render: () => <Parallel />,
  },
]
