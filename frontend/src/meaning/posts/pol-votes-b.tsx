/** Riksdag roll calls per session since 1993/94: attendance, cohesion, agreement. */
import { useState } from 'react'
import { focal, Frame, seq, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { ticksBetween, XAxis, YAxis } from '../axes'
import { arc, every, GovStrip, line, PARTIES } from './pol-kit'

type Session = {
  session: string
  roll_calls: number
  government_key: string
  government_name: string
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

const useSessions = () => useData<Sessions>('parliament/sessions.json')
const recentFirst = (d: Sessions) => d.sessions.map((s) => s.session).reverse()

/** Lower triangle of party pairs: each cell is the share of roll calls where the two parties
 * took the same position, written out and shaded on one sequential ramp. */
function Matrix() {
  const data = useSessions()
  const [s, setS] = useState('2025/26')
  return (
    <Frame data={data}>
      {(d) => {
        const pairs = d.party_pairs.filter((p) => p.session === s)
        const get = (a: string, b: string) =>
          pairs.find(
            (q) =>
              (q.party_a === a && q.party_b === b) ||
              (q.party_a === b && q.party_b === a),
          )?.agreement_pct
        const ps = PARTIES.filter((p) =>
          pairs.some((q) => q.party_a === p || q.party_b === p),
        )
        const c = 252 / Math.max(ps.length - 1, 1)
        return (
          <>
            <Slicer
              label="Session"
              cycles
              options={every(recentFirst(d), 3).reverse()}
              value={s}
              onChange={setS}
            />
            <svg
              viewBox="0 0 300 280"
              role="img"
              aria-label={`Share of roll calls where two parties voted the same way, ${s}`}
            >
              {ps.slice(1).map((a, i) => (
                <g key={a}>
                  <g className="mean-end">
                    <text x={34} y={i * c + c / 2 + 4} textAnchor="end">
                      {a}
                    </text>
                  </g>
                  {ps.slice(0, i + 1).map((b, j) => {
                    const v = get(a, b)
                    return v === undefined ? null : (
                      <g key={b}>
                        <rect
                          x={40 + j * c}
                          y={i * c}
                          width={c - 2}
                          height={c - 2}
                          fill={seq(v / 100)}
                        >
                          <title>{`${a} and ${b}: ${v} %`}</title>
                        </rect>
                        <text
                          x={40 + j * c + c / 2 - 1}
                          y={i * c + c / 2 + 3}
                          textAnchor="middle"
                          className="mean-pol-cellv"
                          style={
                            v > 55 ? { fill: 'var(--mean-card)' } : undefined
                          }
                        >
                          {Math.round(v)}
                        </text>
                      </g>
                    )
                  })}
                </g>
              ))}
              <g className="mean-end">
                {ps.slice(0, -1).map((b, j) => (
                  <text
                    key={b}
                    x={40 + j * c + c / 2 - 1}
                    y={(ps.length - 1) * c + 14}
                    textAnchor="middle"
                  >
                    {b}
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

function Gauge() {
  const data = useSessions()
  const [s, setS] = useState('2025/26')
  return (
    <Frame data={data}>
      {(d) => {
        const v =
          d.government_record.find((g) => g.session === s)
            ?.government_won_pct ?? 0
        const a0 = -Math.PI / 2
        return (
          <>
            <Slicer
              label="Session"
              cycles
              options={every(recentFirst(d), 4)}
              value={s}
              onChange={setS}
            />
            <svg
              viewBox="0 0 300 180"
              role="img"
              aria-label={`Share of decisions the government won, ${s}`}
            >
              <path d={arc(150, 160, 90, 130, a0, -a0)} fill="var(--wash)" />
              <path
                d={arc(150, 160, 90, 130, a0, a0 + (v / 100) * Math.PI)}
                fill="var(--accent)"
              />
              <text
                x={150}
                y={156}
                textAnchor="middle"
                style={{ fontSize: 40, fontWeight: 600, fill: 'var(--ink)' }}
              >
                {v}%
              </text>
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

function GovWon() {
  return (
    <Frame data={useSessions()}>
      {(d) => {
        const g = d.government_record
        const step = 548 / g.length
        const x = (i: number) => 44 + step * (i + 0.5)
        const lo = Math.min(80, Math.floor(wonRange(d)[0] / 10) * 10)
        const y = linearScale([lo, 100], [146, 10])
        return (
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label="Share of decisions won by the government per session"
          >
            <YAxis
              y={y}
              ticks={ticksBetween(lo, 100)}
              x0={44}
              x1={592}
              format={(v) => `${v} %`}
            />
            <path
              d={line(g.map((r, i) => [x(i), y(r.government_won_pct)]))}
              fill="none"
              stroke={focal(true)}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {g.map((r, i) => (
              <circle
                key={r.session}
                cx={x(i)}
                cy={y(r.government_won_pct)}
                r={2.5}
                fill={focal(true)}
              >
                <title>{`${r.session}: ${r.government_won_pct} %`}</title>
              </circle>
            ))}
            <GovStrip sessions={d.sessions} x={x} step={step} y={156} />
            <XAxis
              y={194}
              x={x}
              ticks={every(
                g.map((_, i) => i),
                8,
              ).map((i) => ({ value: i, label: g[i].session }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

const wonRange = (d: Sessions) => {
  const v = d.government_record.map((r) => r.government_won_pct)
  return [Math.min(...v), Math.max(...v)]
}

export const posts: Post[] = [
  {
    id: 'pol-gov-gauge',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    render: () => <Gauge />,
  },
  {
    id: 'pol-agree-matrix',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    title: 'How often two parties voted the same way',
    note: 'Share of roll calls with the same position, %, per session. Source: Riksdagen.',
    render: () => <Matrix />,
  },
  {
    id: 'pol-gov-won',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    title: (d: Sessions) => {
      const [lo, hi] = wonRange(d)
      return `The government won between ${lo} % and ${hi} % of Riksdag decisions per session`
    },
    note: 'Share of decisions won per session, with the government of the day. Source: Riksdagen.',
    render: () => <GovWon />,
  },
]
