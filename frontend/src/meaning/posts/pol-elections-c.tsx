/** Riksdag election results 1973 onward and the 2026 count. */
import { Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { pc, signed } from './pol-kit'

type NowParty = {
  party: string
  share_pct: number
  seats: number
  previous_share_pct: number
  previous_seats: number
}
type Now = { election: { year: number; majority: number; parties: NowParty[] } }

const useNow = () => useData<Now>('parliament/now.json')
function SeatSwing() {
  return (
    <Frame data={useNow()}>
      {(n) => {
        const delta = (p: NowParty) => p.seats - p.previous_seats
        const ps = n.election.parties
          .filter((p) => p.seats || p.previous_seats)
          .sort((a, b) => delta(b) - delta(a))
        const m = Math.max(...ps.map((p) => Math.abs(delta(p))), 1)
        const x = linearScale([-m, m], [30, 270])
        return (
          <svg
            viewBox="0 0 300 220"
            role="img"
            aria-label={`Change in seats at the ${n.election.year} election`}
          >
            <line
              x1={x(0)}
              x2={x(0)}
              y1={0}
              y2={210}
              className="mean-pol-grid"
            />
            {ps.map((p, i) => {
              const dv = delta(p)
              return (
                <g key={p.party}>
                  <rect
                    x={Math.min(x(0), x(dv))}
                    y={6 + i * 23}
                    width={Math.abs(x(dv) - x(0))}
                    height={17}
                    rx={3}
                    fill={pc(p.party)}
                  />
                  <text
                    x={dv >= 0 ? x(0) - 4 : x(0) + 4}
                    y={18 + i * 23}
                    textAnchor={dv >= 0 ? 'end' : 'start'}
                    className="mean-pol-t"
                  >
                    {p.party} {signed(dv, 0)}
                  </text>
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
    id: 'pol-seat-swing',
    domain: 'politics',
    sources: ['parliament/now.json'],
    title: 'Seats won and lost at the latest Riksdag election',
    note: 'Change in seats against the previous election. Source: Valmyndigheten.',
    render: () => <SeatSwing />,
  },
]
