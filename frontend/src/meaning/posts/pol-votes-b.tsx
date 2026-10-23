/** Riksdag roll calls per session since 1993/94: attendance, cohesion, agreement. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { arc, every, line, PARTIES, uniq, XTicks, YGrid } from './pol-kit'

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

const useSessions = () => useData<Sessions>('parliament/sessions.json')
const short = (s: string) => s.slice(2)
const recentFirst = (d: Sessions) => d.sessions.map((s) => s.session).reverse()

function Matrix() {
  const data = useSessions()
  const [s, setS] = useState('2016/17')
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
        return (
          <>
            <Slicer
              label="Session"
              options={every(recentFirst(d), 3)}
              value={s}
              onChange={setS}
            />
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label={`Agreement matrix, ${s}`}
            >
              {PARTIES.map((a, i) => (
                <g key={a}>
                  <text
                    x={22}
                    y={i * 34 + 54}
                    textAnchor="end"
                    className="mean-pol-t"
                  >
                    {a}
                  </text>
                  <text
                    x={i * 34 + 45}
                    y={22}
                    textAnchor="middle"
                    className="mean-pol-t"
                  >
                    {a}
                  </text>
                  {PARTIES.map((b, j) => {
                    const v = a === b ? 100 : get(a, b)
                    return v === undefined ? null : (
                      <rect
                        key={b}
                        x={28 + j * 34}
                        y={30 + i * 34}
                        width={32}
                        height={32}
                        rx={4}
                        fill="var(--accent)"
                        opacity={(v / 100) ** 2}
                      >
                        <title>{`${a}–${b}: ${v}%`}</title>
                      </rect>
                    )
                  })}
                </g>
              ))}
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
        const govs = uniq(d.sessions.map((s) => s.government_key))
        const x = linearScale([0, g.length - 1], [30, 630])
        const y = linearScale([50, 100], [150, 10])
        const w = 600 / (g.length - 1)
        return (
          <>
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label="Share of decisions won by the government per session"
            >
              {d.sessions.map((s, i) => (
                <rect
                  key={s.session}
                  x={x(i) - w / 2}
                  y={160}
                  width={w}
                  height={14}
                  fill={color(govs.indexOf(s.government_key))}
                />
              ))}
              <YGrid ticks={[50, 75, 100]} x0={30} x1={630} y={y} />
              <path
                d={line(g.map((r, i) => [x(i), y(r.government_won_pct)]))}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
              />
              {g.map((r, i) => (
                <circle
                  key={r.session}
                  cx={x(i)}
                  cy={y(r.government_won_pct)}
                  r={3}
                  fill="var(--ink)"
                >
                  <title>{`${r.session}: ${r.government_won_pct}%`}</title>
                </circle>
              ))}
              <XTicks
                y={186}
                ticks={every(g, 4).map((r) => ({
                  x: x(g.indexOf(r)),
                  label: short(r.session),
                }))}
              />
            </svg>
            <div className="mean-legend">
              {govs.map((k, i) => (
                <span key={k}>
                  <i style={{ background: color(i) }} />
                  {k}
                </span>
              ))}
            </div>
          </>
        )
      }}
    </Frame>
  )
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
    render: () => <Matrix />,
  },
  {
    id: 'pol-gov-won',
    domain: 'politics',
    sources: ['parliament/sessions.json'],
    size: 'wide',
    render: () => <GovWon />,
  },
]
