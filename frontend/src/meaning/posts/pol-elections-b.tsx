/** Riksdag election results 1973 onward and the 2026 count. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  band,
  every,
  groupBy,
  line,
  pc,
  PARTIES,
  squarify,
  XTicks,
} from './pol-kit'

type Result = {
  election_year: number
  party: string
  votes: number | null
  share_pct: number | null
  seats: number | null
}
type Elections = { years: number[]; majority: number; results: Result[] }
type NowParty = {
  party: string
  share_pct: number
  seats: number
  previous_share_pct: number
  previous_seats: number
}
type Now = { election: { year: number; majority: number; parties: NowParty[] } }

const ORDER: string[] = [...PARTIES, 'NYD', 'OTHER']
const useElections = () => useData<Elections>('parliament/elections.json')
const useNow = () => useData<Now>('parliament/now.json')
const byYear = (d: Elections, y: number) =>
  d.results
    .filter((r) => r.election_year === y)
    .sort((a, b) => ORDER.indexOf(a.party) - ORDER.indexOf(b.party))

function VotesTreemap() {
  const data = useElections()
  const [year, setYear] = useState(2022)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = byYear(d, year).filter((r) => (r.votes ?? 0) > 0)
        const rects = squarify(rows, (r) => r.votes!, {
          x: 0,
          y: 0,
          w: 300,
          h: 300,
        })
        return (
          <>
            <Slicer
              label="Election year"
              options={every([...d.years].reverse(), 3)}
              value={year}
              onChange={setYear}
            />
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label={`Votes per party in ${year}`}
            >
              {rects.map((r) => (
                <g key={r.item.party}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={pc(r.item.party)}
                    stroke="var(--paper)"
                    strokeWidth={2}
                  />
                  {r.w > 60 && r.h > 18 && (
                    <text
                      x={r.x + 6}
                      y={r.y + 14}
                      className="mean-pol-t"
                      style={{ fill: 'var(--ink)' }}
                    >
                      {r.item.party}{' '}
                      {Math.round(r.item.votes! / 1000).toLocaleString('sv-SE')}
                      k
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

function Multiples() {
  return (
    <Frame data={useElections()}>
      {(d) => {
        const by = groupBy(d.results, (r) => r.party)
        const x = linearScale([d.years[0], d.years.at(-1)!], [4, 146])
        const y = linearScale([0, 50], [72, 4])
        return (
          <svg
            viewBox="0 0 600 160"
            role="img"
            aria-label="Vote share per party over elections, small multiples"
          >
            {PARTIES.map((p, i) => {
              const rows = by.get(p) ?? []
              const pts = rows.map(
                (r) =>
                  [x(r.election_year), y(r.share_pct ?? 0)] as [number, number],
              )
              return (
                <g
                  key={p}
                  transform={`translate(${(i % 4) * 150},${Math.floor(i / 4) * 80})`}
                >
                  <path
                    d={band(
                      pts,
                      pts.map(([px]) => [px, 72]),
                    )}
                    fill={pc(p)}
                    opacity={0.35}
                  />
                  <path
                    d={line(pts)}
                    fill="none"
                    stroke={pc(p)}
                    strokeWidth={2}
                  />
                  <text x={6} y={12} className="mean-pol-t">
                    {p} {rows.length ? `${rows.at(-1)!.share_pct}%` : ''}
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

function Slope() {
  return (
    <Frame data={useNow()}>
      {(n) => {
        const ps = n.election.parties.filter((p) => ORDER.includes(p.party))
        const max = Math.max(
          ...ps.flatMap((p) => [p.share_pct, p.previous_share_pct]),
        )
        const y = linearScale([0, max], [390, 20])
        return (
          <svg
            viewBox="0 0 200 410"
            role="img"
            aria-label="Vote share, previous election to 2026"
          >
            {ps.map((p) => (
              <g key={p.party} stroke={pc(p.party)} fill={pc(p.party)}>
                <line
                  x1={50}
                  x2={150}
                  y1={y(p.previous_share_pct)}
                  y2={y(p.share_pct)}
                  strokeWidth={3}
                />
                <circle cx={50} cy={y(p.previous_share_pct)} r={4} />
                <circle cx={150} cy={y(p.share_pct)} r={4} />
                <text
                  x={44}
                  y={y(p.previous_share_pct) + 3}
                  textAnchor="end"
                  className="mean-pol-t"
                  stroke="none"
                >
                  {p.previous_share_pct}%
                </text>
                <text
                  x={156}
                  y={y(p.share_pct) + 3}
                  className="mean-pol-t"
                  stroke="none"
                >
                  {p.party} {p.share_pct}%
                </text>
              </g>
            ))}
            <XTicks
              y={406}
              ticks={[
                { x: 50, label: n.election.year - 4 },
                { x: 150, label: n.election.year },
              ]}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-slope-2026',
    domain: 'politics',
    size: 'tall',
    render: () => <Slope />,
  },
  {
    id: 'pol-share-multiples',
    domain: 'politics',
    size: 'wide',
    render: () => <Multiples />,
  },
  {
    id: 'pol-votes-treemap',
    domain: 'politics',
    render: () => <VotesTreemap />,
  },
]
