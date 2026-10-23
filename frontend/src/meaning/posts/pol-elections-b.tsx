/** Riksdag election results 1973 onward and the 2026 count. */
import { Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import {
  best,
  groupBy,
  isParty,
  line,
  pc,
  pct,
  PARTIES,
  signed,
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

const useElections = () => useData<Elections>('parliament/elections.json')
const useNow = () => useData<Now>('parliament/now.json')

/** One panel per party on a shared 0–50 % scale, so heights compare across panels. */
function Multiples() {
  return (
    <Frame data={useElections()}>
      {(d) => {
        if (d.years.length < 2) return null
        const by = groupBy(d.results, (r) => r.party)
        const first = d.years[0]
        const last = d.years.at(-1)!
        const x = linearScale([first, last], [8, 136])
        const y = linearScale([0, 50], [92, 22])
        return (
          <svg
            viewBox="0 0 600 220"
            role="img"
            aria-label="Vote share per party over elections, one panel per party"
          >
            {PARTIES.map((p, i) => {
              const rows = (by.get(p) ?? []).filter((r) => r.share_pct != null)
              const pts = rows.map(
                (r) =>
                  [x(r.election_year), y(r.share_pct!)] as [number, number],
              )
              const end = rows.at(-1)
              return (
                <g
                  key={p}
                  transform={`translate(${(i % 4) * 150},${Math.floor(i / 4) * 106})`}
                >
                  <g className="mean-axis">
                    <line x1={8} x2={136} y1={y(0)} y2={y(0)} />
                    <line x1={8} x2={136} y1={y(25)} y2={y(25)} />
                    {i === 0 && (
                      <text x={136} y={y(25) - 3} textAnchor="end">
                        25 %
                      </text>
                    )}
                    {i >= 4 && (
                      <>
                        <text x={x(first)} y={106} textAnchor="start">
                          {first}
                        </text>
                        <text x={x(last)} y={106} textAnchor="end">
                          {last}
                        </text>
                      </>
                    )}
                  </g>
                  <path
                    d={line(pts)}
                    fill="none"
                    stroke={pc(p)}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  <g className="mean-end">
                    <text x={8} y={12}>
                      {p}
                      {end && (
                        <tspan className="mean-pol-val">
                          {' '}
                          {pct(end.share_pct!)}
                        </tspan>
                      )}
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

const change = (p: NowParty) => p.share_pct - p.previous_share_pct
const parties = (n: Now) => n.election.parties.filter((p) => isParty(p.party))

/** Each party's previous and latest share on one row, sorted by the latest. */
function Dumbbell() {
  return (
    <Frame data={useNow()}>
      {(n) => {
        const ps = parties(n).sort((a, b) => b.share_pct - a.share_pct)
        if (!ps.length) return null
        const [, hi] = niceDomain(
          0,
          Math.max(...ps.flatMap((p) => [p.share_pct, p.previous_share_pct])),
        )
        const x = linearScale([0, hi], [30, 206])
        const row = (i: number) => 16 + i * 27
        const bottom = row(ps.length - 1) + 12
        return (
          <svg
            viewBox="0 0 300 250"
            role="img"
            aria-label={`Vote share per party, previous election and ${n.election.year}`}
          >
            <g className="mean-axis">
              {ticksBetween(0, hi).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={bottom} />
                  <text x={x(t)} y={bottom + 14} textAnchor="middle">
                    {t} %
                  </text>
                </g>
              ))}
            </g>
            {ps.map((p, i) => (
              <g key={p.party}>
                <line
                  x1={x(p.previous_share_pct)}
                  x2={x(p.share_pct)}
                  y1={row(i)}
                  y2={row(i)}
                  stroke={pc(p.party)}
                  strokeWidth={2.5}
                />
                <circle
                  cx={x(p.previous_share_pct)}
                  cy={row(i)}
                  r={4}
                  fill="var(--paper)"
                  stroke={pc(p.party)}
                  strokeWidth={2}
                />
                <circle
                  cx={x(p.share_pct)}
                  cy={row(i)}
                  r={5.5}
                  fill={pc(p.party)}
                >
                  <title>{`${p.party}: ${p.previous_share_pct} → ${p.share_pct} %`}</title>
                </circle>
                <g className="mean-end">
                  <text x={0} y={row(i) + 4}>
                    {p.party}
                  </text>
                  <text x={298} y={row(i) + 4} textAnchor="end">
                    {pct(p.share_pct)}{' '}
                    <tspan className="mean-pol-val">{signed(change(p))}</tspan>
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

/** The largest rise and the largest fall in share, worded by their actual sign. */
function swingTitle(n: Now) {
  const ps = parties(n)
  const up = best(ps, change)
  const down = best(ps, (p) => -change(p))
  if (!up || !down) return 'Vote share per party, previous and latest election'
  const rise =
    change(up) > 0
      ? `${up.party} gained the most share (${signed(change(up))} points)`
      : `every party lost share; ${up.party} the least (${signed(change(up))})`
  const fall =
    change(down) < 0
      ? `${down.party} lost the most (${signed(change(down))})`
      : `${down.party} gained the least (${signed(change(down))})`
  return `${n.election.year}: ${rise}, ${fall}`
}

export const posts: Post[] = [
  {
    id: 'pol-slope-2026',
    domain: 'politics',
    sources: ['parliament/now.json'],
    title: swingTitle,
    note: 'Vote share, %: previous election (open dot), latest (filled). Source: Valmyndigheten.',
    render: () => <Dumbbell />,
  },
  {
    id: 'pol-share-multiples',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    size: 'wide',
    title: (d: Elections) =>
      d.years.length
        ? `Each party's vote share, ${d.years[0]}–${d.years.at(-1)}`
        : "Each party's vote share",
    note: 'Share of votes, %; every panel uses the same scale. Source: Valmyndigheten.',
    render: () => <Multiples />,
  },
]
