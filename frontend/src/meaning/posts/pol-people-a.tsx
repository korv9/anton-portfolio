/** Members of the Riksdag and municipal council seats per party. */
import { Frame, tile, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { arc, Legend, pc, PARTIES, sum, XTicks } from './pol-kit'

type PartyStat = {
  members: number
  women: number
  ministers: unknown[]
  council_seats: number
  council_seats_before: number
}
type Index = { parties: Record<string, PartyStat> }

const useIndex = () => useData<Index>('politics/parties/index.json')
const present = (d: Index) => PARTIES.filter((p) => d.parties[p])

function Units() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const dots = present(d).flatMap((p) =>
          Array.from({ length: d.parties[p].members }, (_, i) => ({
            p,
            woman: i < d.parties[p].women,
          })),
        )
        const cols = 19
        return (
          <>
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label="Members per party, women filled, men outlined"
            >
              {dots.map((m, i) => (
                <circle
                  key={i}
                  cx={10 + (i % cols) * 15.5}
                  cy={10 + Math.floor(i / cols) * 15.5}
                  r={5.5}
                  fill={m.woman ? pc(m.p) : 'none'}
                  stroke={pc(m.p)}
                  strokeWidth={1.6}
                >
                  <title>{m.p}</title>
                </circle>
              ))}
            </svg>
            <Legend items={present(d)} />
          </>
        )
      }}
    </Frame>
  )
}

function Dumbbell() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d).sort(
          (a, b) => d.parties[b].council_seats - d.parties[a].council_seats,
        )
        const max = Math.max(
          ...ps.flatMap((p) => [
            d.parties[p].council_seats,
            d.parties[p].council_seats_before,
          ]),
        )
        const x = linearScale([0, max], [28, 290])
        return (
          <svg
            viewBox="0 0 300 236"
            role="img"
            aria-label="Municipal council seats, before and after 2026"
          >
            {ps.map((p, i) => {
              const s = d.parties[p]
              const cy = 14 + i * 27
              return (
                <g key={p}>
                  <line
                    x1={x(s.council_seats_before)}
                    x2={x(s.council_seats)}
                    y1={cy}
                    y2={cy}
                    stroke={pc(p)}
                    strokeWidth={3}
                  />
                  <circle
                    cx={x(s.council_seats_before)}
                    cy={cy}
                    r={4}
                    fill="var(--paper)"
                    stroke={pc(p)}
                    strokeWidth={2}
                  />
                  <circle cx={x(s.council_seats)} cy={cy} r={7} fill={pc(p)}>
                    <title>{`${p}: ${s.council_seats_before} → ${s.council_seats}`}</title>
                  </circle>
                  <text x={0} y={cy + 3} className="mean-pol-t">
                    {p}
                  </text>
                </g>
              )
            })}
            <XTicks
              y={232}
              ticks={[0, max].map((v) => ({
                x: x(v),
                label: v.toLocaleString('sv-SE'),
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

function Donut() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d)
        const total = sum(ps.map((p) => d.parties[p].members))
        let a = 0
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="Members per party, outer ring; women and men per party, inner ring"
          >
            {ps.map((p) => {
              const s = d.parties[p]
              const a0 = a
              const span = (s.members / total) * Math.PI * 2
              const aw = a0 + span * (s.women / s.members)
              a += span
              return (
                <g key={p}>
                  <path
                    d={arc(150, 150, 100, 140, a0, a0 + span - 0.01)}
                    fill={pc(p)}
                  >
                    <title>{`${p}: ${s.members}`}</title>
                  </path>
                  <path
                    d={arc(150, 150, 74, 96, a0, aw)}
                    fill={pc(p)}
                    opacity={0.55}
                  />
                  <path
                    d={arc(150, 150, 74, 96, aw, a0 + span - 0.01)}
                    fill={pc(p)}
                    opacity={0.2}
                  />
                </g>
              )
            })}
            <text
              x={150}
              y={162}
              textAnchor="middle"
              style={{ fontSize: 36, fontWeight: 600, fill: 'var(--ink)' }}
            >
              {Math.round(
                (100 * sum(ps.map((p) => d.parties[p].women))) / total,
              )}
              %
            </text>
          </svg>
        )
      }}
    </Frame>
  )
}

function Ministers() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d).filter((p) => d.parties[p].ministers.length)
        return (
          <div className="mean-pol-grid4">
            {ps.map((p) => (
              <div key={p} className="mean-pol-cell" style={tile(pc(p))}>
                {d.parties[p].ministers.length}
                <small>{p} ministers</small>
              </div>
            ))}
          </div>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'pol-member-units', domain: 'politics', render: () => <Units /> },
  {
    id: 'pol-council-dumbbell',
    domain: 'politics',
    render: () => <Dumbbell />,
  },
  { id: 'pol-gender-donut', domain: 'politics', render: () => <Donut /> },
  { id: 'pol-ministers', domain: 'politics', render: () => <Ministers /> },
]
