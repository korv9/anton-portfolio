/** Riksdag election results 1973 onward and the 2026 count. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { band, every, Legend, line, pc, PARTIES, sum, XTicks } from './pol-kit'

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

/** Room between end labels, in viewBox units. */
const GAP = 18

function StackedShare() {
  return (
    <Frame data={useElections()}>
      {(d) => {
        const x = linearScale([d.years[0], d.years.at(-1)!], [24, 580])
        const y = linearScale([0, 100], [180, 8])
        let base = d.years.map(() => 0)
        // End labels name the bands at the latest election, so no colour has to be matched to
        // the legend. Bands under 4 % go unnamed; the rest are nudged
        // 18 units apart, up first, then down so the top one stays inside the plot.
        const ends: { p: string; y: number }[] = []
        const layers = ORDER.map((p) => {
          const top = d.years.map((yr, i) => base[i] + share(d, yr, p))
          const path = band(
            top.map((v, i) => [x(d.years[i]), y(v)]),
            base.map((v, i) => [x(d.years[i]), y(v)]),
          )
          const last = top.length - 1
          if (top[last] - base[last] >= 4)
            ends.push({ p, y: y((top[last] + base[last]) / 2) + 4 })
          base = top
          return { p, path }
        })
        ends.sort((a, b) => b.y - a.y)
        ends.forEach((e, i) => i && (e.y = Math.min(e.y, ends[i - 1].y - GAP)))
        for (let i = ends.length - 1; i >= 0; i--)
          ends[i].y = Math.max(
            ends[i].y,
            i === ends.length - 1 ? 18 : ends[i + 1].y + GAP,
          )
        return (
          <>
            <svg
              viewBox="0 0 640 196"
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
              {ends.map((e) => (
                <text key={e.p} x={586} y={e.y} className="mean-pol-end">
                  {e.p}
                </text>
              ))}
              <XTicks
                y={194}
                ticks={every(d.years, 2).map((yr) => ({ x: x(yr), label: yr }))}
              />
            </svg>
            <Legend items={ORDER} />
          </>
        )
      }}
    </Frame>
  )
}

function Bump() {
  return (
    <Frame data={useElections()}>
      {(d) => {
        const x = linearScale([d.years[0], d.years.at(-1)!], [16, 610])
        const y = linearScale([1, 8], [12, 172])
        const rank = (yr: number) =>
          PARTIES.filter((p) => share(d, yr, p) > 0).sort(
            (a, b) => share(d, yr, b) - share(d, yr, a),
          )
        return (
          <svg
            viewBox="0 0 640 196"
            role="img"
            aria-label="Party rank by vote share per election"
          >
            {PARTIES.map((p) => {
              const pts = d.years
                .map((yr) => [yr, rank(yr).indexOf(p) + 1] as const)
                .filter(([, r]) => r > 0)
                .map(([yr, r]) => [x(yr), y(r)] as [number, number])
              if (!pts.length) return null
              return (
                <g key={p} stroke={pc(p)} fill={pc(p)}>
                  <path
                    d={line(pts)}
                    fill="none"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.map(([cx, cy], i) => (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r={6}
                      stroke="var(--paper)"
                      strokeWidth={1.5}
                    />
                  ))}
                  <text
                    x={pts.at(-1)![0] + 10}
                    y={pts.at(-1)![1] + 3}
                    className="mean-pol-t"
                    stroke="none"
                  >
                    {p}
                  </text>
                </g>
              )
            })}
            <XTicks
              y={192}
              ticks={every(d.years, 3).map((yr) => ({ x: x(yr), label: yr }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

/** Seats laid out in a hemicycle, rows filled outward, parties left to right. */
function hemicycle(total: number, rows = 9) {
  const radii = Array.from({ length: rows }, (_, i) => 60 + i * 11)
  const per = radii.map((r) => Math.round((total * r) / sum(radii)))
  per[rows - 1] += total - sum(per)
  return radii
    .flatMap((r, i) =>
      Array.from({ length: per[i] }, (_, k) => {
        const a = Math.PI * (per[i] === 1 ? 0.5 : k / (per[i] - 1))
        return { a, x: 160 - r * Math.cos(a), y: 168 - r * Math.sin(a) }
      }),
    )
    .sort((p, q) => p.a - q.a)
}

function Hemicycle() {
  const data = useElections()
  const [year, setYear] = useState(2026)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = byYear(d, year).filter((r) => (r.seats ?? 0) > 0)
        const seats = rows.flatMap((r) =>
          Array.from({ length: r.seats! }, () => r.party),
        )
        const dots = hemicycle(seats.length)
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
              viewBox="0 0 320 180"
              role="img"
              aria-label={`Riksdag seats after the ${year} election`}
            >
              {dots.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.6} fill={pc(seats[i])}>
                  <title>{seats[i]}</title>
                </circle>
              ))}
            </svg>
            <Legend items={rows.map((r) => r.party)} />
          </>
        )
      }}
    </Frame>
  )
}

function Waffle() {
  const data = useElections()
  const [year, setYear] = useState(1994)
  return (
    <Frame data={data}>
      {(d) => {
        const cells: string[] = []
        let acc = 0
        for (const r of byYear(d, year)) {
          const next = acc + (r.share_pct ?? 0)
          for (
            let k = Math.round(acc);
            k < Math.round(next) && cells.length < 100;
            k++
          )
            cells.push(r.party)
          acc = next
        }
        return (
          <>
            <Slicer
              label="Election year"
              cycles
              options={every(d.years, 2)}
              value={year}
              onChange={setYear}
            />
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label={`Vote share in ${year}, one square per percent`}
            >
              {cells.map((p, i) => (
                <rect
                  key={i}
                  x={(i % 10) * 20 + 1}
                  y={Math.floor(i / 10) * 20 + 1}
                  width={18}
                  height={18}
                  rx={4}
                  fill={pc(p)}
                >
                  <title>{p}</title>
                </rect>
              ))}
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
    render: () => <StackedShare />,
  },
  {
    id: 'pol-hemicycle',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    render: () => <Hemicycle />,
  },
  {
    id: 'pol-bump',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    size: 'wide',
    render: () => <Bump />,
  },
  {
    id: 'pol-waffle',
    domain: 'politics',
    sources: ['parliament/elections.json'],
    render: () => <Waffle />,
  },
]
