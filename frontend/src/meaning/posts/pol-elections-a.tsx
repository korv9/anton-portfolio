/** Riksdag election results 1973 onward and the 2026 count. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { spreadLabels } from '../../charts/marks'
import { EndLabels, XAxis, YAxis } from '../axes'
import { band, every, pc, PARTIES, sum } from './pol-kit'

type Result = {
  election_year: number
  party: string
  votes: number | null
  share_pct: number | null
  seats: number | null
}
type Elections = { years: number[]; majority: number; results: Result[] }
const ORDER: string[] = [...PARTIES, 'NYD', 'OTHER']
const useElections = () => useData<Elections>('parliament/elections.json')
const byYear = (d: Elections, y: number) =>
  d.results
    .filter((r) => r.election_year === y)
    .sort((a, b) => ORDER.indexOf(a.party) - ORDER.indexOf(b.party))
const share = (d: Elections, y: number, p: string) =>
  d.results.find((r) => r.election_year === y && r.party === p)?.share_pct ?? 0

function StackedShare() {
  return (
    <Frame data={useElections()}>
      {(d) => {
        const x = linearScale([d.years[0], d.years.at(-1)!], [34, 548])
        const y = linearScale([0, 100], [178, 8])
        let base = d.years.map(() => 0)
        // End labels name the bands at the latest election, so no legend is needed. Bands
        // under 4 % go unnamed.
        const ends: { y: number; label: string }[] = []
        const layers = ORDER.map((p) => {
          const top = d.years.map((yr, i) => base[i] + share(d, yr, p))
          const path = band(
            top.map((v, i) => [x(d.years[i]), y(v)]),
            base.map((v, i) => [x(d.years[i]), y(v)]),
          )
          const last = top.length - 1
          if (top[last] - base[last] >= 4)
            ends.push({
              label: p === 'OTHER' ? 'Other' : p,
              y: y((top[last] + base[last]) / 2),
            })
          base = top
          return { p, path }
        })
        return (
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label="Vote share by party, stacked, per election"
          >
            {layers.map((l) => (
              <path
                key={l.p}
                d={l.path}
                fill={pc(l.p)}
                stroke="var(--paper)"
                strokeWidth={0.6}
              >
                <title>{l.p}</title>
              </path>
            ))}
            <YAxis
              y={y}
              ticks={[0, 50, 100]}
              x0={34}
              x1={548}
              format={(v) => `${v} %`}
            />
            <EndLabels items={ends} x={554} top={12} bottom={178} />
            <XAxis
              y={194}
              x={x}
              ticks={every(d.years, 3).map((yr) => ({
                value: yr,
                label: String(yr),
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

/** One bar of all seats, parties in bloc order from the left, the majority marked. */
function SeatBar() {
  const data = useElections()
  const [year, setYear] = useState(2026)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = byYear(d, year).filter((r) => (r.seats ?? 0) > 0)
        const total = sum(rows.map((r) => r.seats!))
        const x = linearScale([0, total], [4, 296])
        let acc = 0
        const segs = rows.map((r) => {
          const from = acc
          acc += r.seats!
          return {
            p: r.party,
            seats: r.seats!,
            from,
            y: x(from + r.seats! / 2),
          }
        })
        // Labels sit above and below the bar, pushed apart sideways so narrow parties keep
        // theirs (spreadLabels works on any one axis).
        const spread = spreadLabels(segs, 30, 16, 284)
        return (
          <>
            <Slicer
              label="Election year"
              cycles
              options={d.years.slice(-8)}
              value={year}
              onChange={setYear}
            />
            <svg
              viewBox="0 0 300 150"
              role="img"
              aria-label={`Riksdag seats per party after the ${year} election; ${d.majority} make a majority`}
            >
              {segs.map((s) => (
                <rect
                  key={s.p}
                  x={x(s.from)}
                  y={44}
                  width={x(s.from + s.seats) - x(s.from)}
                  height={44}
                  rx={0}
                  fill={pc(s.p)}
                  stroke="var(--paper)"
                  strokeWidth={1}
                >
                  <title>{`${s.p}: ${s.seats} seats`}</title>
                </rect>
              ))}
              <g className="mean-end">
                {spread.map((s) => (
                  <text key={s.p} x={s.labelY} y={36} textAnchor="middle">
                    {s.p}
                  </text>
                ))}
              </g>
              <g className="mean-axis">
                {spread.map((s) => (
                  <text key={s.p} x={s.labelY} y={104} textAnchor="middle">
                    {s.seats}
                  </text>
                ))}
              </g>
              <g className="mean-axis mean-ref">
                <line
                  x1={x(d.majority)}
                  x2={x(d.majority)}
                  y1={40}
                  y2={118}
                  strokeDasharray="3 3"
                  style={{ stroke: 'var(--mean-ink)', strokeWidth: 1 }}
                />
                <text x={x(d.majority)} y={132} textAnchor="middle">
                  {d.majority} seats for a majority
                </text>
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
    id: 'pol-share-stacked',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    size: 'wide',
    title: (d: { years: number[] }) =>
      `Vote share by party in Riksdag elections, ${d.years[0]}–${d.years.at(-1)}`,
    note: 'Share of votes cast, %. Source: Valmyndigheten.',
    render: () => <StackedShare />,
  },
  {
    id: 'pol-hemicycle',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    title: (d: { years: number[] }) =>
      `Riksdag seats per party, ${d.years.at(-8)}–${d.years.at(-1)} elections`,
    note: 'Seats of 349, parties from left to right. Source: Valmyndigheten.',
    render: () => <SeatBar />,
  },
]
