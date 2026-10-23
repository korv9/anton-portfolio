/** Riksdag roll calls per session since 1993/94: party agreement and government wins. */
import { useState } from 'react'
import { cellInk, focal, Frame, seq, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { ticksBetween, XAxis, YAxis } from '../axes'
import { every, GovStrip, line, PARTIES } from './pol-kit'

type Session = {
  session: string
  government_key: string
  government_name: string
}
type Pair = {
  session: string
  party_a: string
  party_b: string
  agreement_pct: number
}
type Sessions = {
  sessions: Session[]
  party_pairs: Pair[]
  government_record: { session: string; government_won_pct: number }[]
}

const useSessions = () => useData<Sessions>('parliament/sessions.json')
/** Every third session back from the latest, oldest first, so the cycle reads forwards. */
const sessionSteps = (d: Sessions) =>
  every(d.sessions.map((s) => s.session).reverse(), 3).reverse()

/** Lower triangle of party pairs: each cell is the share of roll calls where the two parties
 * took the same position, written out and shaded on one sequential ramp. */
function Matrix() {
  const data = useSessions()
  const [picked, setS] = useState<string | null>(null)
  return (
    <Frame data={data}>
      {(d) => {
        const options = sessionSteps(d)
        const s = picked ?? options.at(-1)
        if (!s) return null
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
              options={options}
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
                          style={cellInk(v / 100)}
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

/** Sessions in order with the share of decisions the government won, null where the record
 * has no figure: one list places both the line and the government bands. */
const govRows = (d: Sessions) => {
  const won = new Map(
    d.government_record.map((r) => [r.session, r.government_won_pct]),
  )
  return d.sessions.map((s) => ({ ...s, won: won.get(s.session) ?? null }))
}
const wonRange = (d: Sessions) => {
  const v = govRows(d)
    .map((r) => r.won)
    .filter((w) => w !== null)
  return v.length ? [Math.min(...v), Math.max(...v)] : null
}

function GovWon() {
  return (
    <Frame data={useSessions()}>
      {(d) => {
        const rows = govRows(d)
        const range = wonRange(d)
        if (!range) return null
        const step = 548 / rows.length
        const x = (i: number) => 44 + step * (i + 0.5)
        const lo = Math.min(80, Math.floor(range[0] / 10) * 10)
        const y = linearScale([lo, 100], [146, 10])
        const pts = rows.flatMap((r, i) =>
          r.won === null ? [] : [{ i, s: r.session, won: r.won }],
        )
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
              d={line(pts.map((p) => [x(p.i), y(p.won)]))}
              fill="none"
              stroke={focal(true)}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {pts.map((p) => (
              <circle
                key={p.s}
                cx={x(p.i)}
                cy={y(p.won)}
                r={2.5}
                fill={focal(true)}
              >
                <title>{`${p.s}: ${p.won} %`}</title>
              </circle>
            ))}
            <GovStrip sessions={rows} x={x} step={step} y={156} />
            <XAxis
              y={194}
              x={x}
              ticks={every(
                rows.map((_, i) => i),
                8,
              ).map((i) => ({ value: i, label: rows[i].session }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
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
      const r = wonRange(d)
      return r
        ? `The government won between ${r[0]} % and ${r[1]} % of Riksdag decisions per session`
        : 'Share of Riksdag decisions the government won'
    },
    note: 'Share of decisions won per session, with the government of the day. Source: Riksdagen.',
    render: () => <GovWon />,
  },
]
