/** Public libraries: where they are, how much they are used, and a relationship tested. */
import { useState } from 'react'
import { Frame, Slicer, focal, shade, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Scatter } from './wel-charts'
import {
  Legend,
  Svg,
  axis,
  band,
  extent,
  fmt,
  groupBy,
  num,
  path,
  scale,
} from './wel-kit'

type Connections = {
  relationships: {
    id: string
    x?: { name: string; unit: string }
    y?: { name: string; unit: string }
    result: {
      rho?: number
      n?: number
      points?: [string, number, number][]
    }
  }[]
}

type Libraries = {
  libraries: {
    code: string
    type: string
    x: number | null
    y: number | null
  }[]
}

type Belonging = {
  rows: ({ code: string; year: number } & Partial<
    Record<Rate, number | null>
  >)[]
}

type Rate =
  | 'visits_rate'
  | 'active_borrowers_rate'
  | 'activities_rate'
  | 'service_points_rate'

/** The rates' units, as export_belonging.py writes them. */
const LIBRARY_RATES: Record<Rate, string> = {
  active_borrowers_rate: 'Active borrowers per 100 inhabitants',
  visits_rate: 'Library visits per inhabitant',
  activities_rate: 'Public activities per 1,000 inhabitants',
  service_points_rate: 'Service points per 10,000 inhabitants',
}

/** KB's library types in plain words; the combined type is the focal one. */
const TYPES: Record<string, string> = {
  folkbib: 'Public library',
  folkskolbib: 'Public and school library in one',
}

/** The one relationship tested on municipality points, which a scatter can show. */
const scattered = (d: Connections) =>
  d.relationships.find((r) => r.result.points?.length && r.x && r.y)

function Relation() {
  return (
    <Frame data={useData<Connections>('sweden/connections/connections.json')}>
      {(d) => {
        const r = scattered(d)
        if (!r) return null
        return (
          <Scatter
            r={2.2}
            label={`${r.x!.name} against ${r.y!.name}, one dot per municipality`}
            xFormat={(v) => `${fmt(v / 1000, 0)}k`}
            yFormat={(v) => fmt(v, 1)}
            dots={r.result
              .points!.filter((p) => num(p[1]) && num(p[2]))
              .map((p) => ({ key: p[0], name: p[0], x: p[1], y: p[2] }))}
          />
        )
      }}
    </Frame>
  )
}

const located = (d: Libraries) =>
  d.libraries.filter((l) => num(l.x) && num(l.y))

function LibraryMap() {
  return (
    <Frame data={useData<Libraries>('sweden/belonging/libraries.json')}>
      {(d) => {
        const libs = located(d)
        const [x0, x1] = extent(libs.map((l) => l.x!))
        const [y0, y1] = extent(libs.map((l) => l.y!))
        const k = Math.min(280 / (x1 - x0), 580 / (y1 - y0))
        const types = Object.keys(TYPES)
        const fill = (t: string) => focal(t === 'folkskolbib')
        return (
          <>
            <Svg
              w={300}
              h={600}
              label="Every public library in Sweden as a dot"
            >
              {/* The focal type is drawn last, on top. */}
              {[...libs]
                .sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type))
                .map((l, i) => (
                  <circle
                    key={i}
                    cx={10 + (l.x! - x0) * k}
                    cy={590 - (l.y! - y0) * k}
                    r={2.2}
                    fill={fill(l.type)}
                    opacity={0.85}
                  />
                ))}
            </Svg>
            <Legend
              items={types.map((t) => TYPES[t])}
              colors={types.map(fill)}
            />
          </>
        )
      }}
    </Frame>
  )
}

/** Per year, the 10th, 25th, 50th, 75th and 90th percentile across municipalities. */
function quantiles(d: Belonging, m: Rate) {
  return [
    ...groupBy(
      d.rows.filter((r) => num(r[m])),
      (r) => r.year,
    ),
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([yr, list]) => {
      const v = list.map((r) => r[m]!).sort((a, b) => a - b)
      const q = (p: number) => v[Math.floor(p * (v.length - 1))]
      return { yr, q: [q(0.1), q(0.25), q(0.5), q(0.75), q(0.9)] }
    })
}

const BANDS = [shade(3, 5), shade(1, 5), focal(true)]

function LibraryTrend() {
  const data = useData<Belonging>('sweden/belonging/municipalities.json')
  const [m, setM] = useState<Rate>('active_borrowers_rate')
  return (
    <Frame data={data}>
      {(d) => {
        const qs = quantiles(d, m)
        const ax = axis(
          qs.map((q) => q.q[4]),
          [176, 12],
        )
        const x = scale([0, qs.length - 1], [34, 250])
        const xs = qs.map((_, i) => x(i))
        const at = (j: number) => qs.map((q) => ax.y(q.q[j]))
        const last = qs.at(-1)!
        return (
          <>
            <Slicer
              label="Rate"
              options={Object.keys(LIBRARY_RATES) as Rate[]}
              format={(k) => LIBRARY_RATES[k]}
              value={m}
              onChange={setM}
            />
            <Svg
              label={`${LIBRARY_RATES[m]} across municipalities: median with the middle 50 and 80 percent`}
            >
              <YAxis
                y={ax.y}
                ticks={ax.ticks}
                x0={34}
                x1={250}
                format={(v) => fmt(v, 1)}
              />
              <path d={band(xs, at(4), at(0))} fill={BANDS[0]} />
              <path d={band(xs, at(3), at(1))} fill={BANDS[1]} />
              <path
                d={path(qs.map((q, i) => [x(i), ax.y(q.q[2])]))}
                fill="none"
                stroke={BANDS[2]}
                strokeWidth={2}
              />
              <EndLabels
                x={255}
                top={12}
                bottom={176}
                items={[{ y: ax.y(last.q[2]), label: fmt(last.q[2], 1) }]}
              />
              <XAxis
                x={x}
                y={194}
                ticks={qs
                  .map((q, i) => ({ value: i, label: String(q.yr) }))
                  .filter((_, i) => i % 4 === 0 || i === qs.length - 1)}
              />
            </Svg>
            <Legend
              items={['Median', 'Middle 50%', 'Middle 80%']}
              colors={[BANDS[2], BANDS[1], BANDS[0]]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-library-map',
    domain: 'sweden',
    sources: ['sweden/belonging/libraries.json'],
    size: 'tall',
    title: (d: Libraries) => {
      const libs = located(d)
      const both = libs.filter((l) => l.type === 'folkskolbib').length
      return `${libs.length.toLocaleString('en-GB')} public libraries; ${both} of them are also school libraries`
    },
    note: 'One dot per library; accent: combined public and school libraries. Source: KB library statistics',
    render: () => <LibraryMap />,
  },
  {
    id: 'wel-connections-scatter',
    domain: 'sweden',
    sources: ['sweden/connections/connections.json'],
    title: (d: Connections) => {
      const r = scattered(d)
      const rho = r?.result.rho
      if (!r || !num(rho)) return 'Library visits and income by municipality'
      const how = Math.abs(rho) < 0.3 ? 'barely follow' : 'follow'
      return `Library visits ${how} median income across ${r.result.n ?? r.result.points!.length} municipalities (ρ = ${fmt(rho, 2)})`
    },
    note: 'Across: median earned income, SEK. Up: library visits per inhabitant. ρ: rank correlation. Sources: Kolada, KB',
    render: () => <Relation />,
  },
  {
    id: 'wel-library-bands',
    domain: 'sweden',
    sources: ['sweden/belonging/municipalities.json'],
    title: (d: Belonging) => {
      const qs = quantiles(d, 'active_borrowers_rate')
      if (qs.length < 2) return 'Active library borrowers per municipality'
      const [a, b] = [qs[0], qs.at(-1)!]
      const dir = b.q[2] < a.q[2] ? 'fell' : 'rose'
      return `In the median municipality, active borrowers ${dir} from ${fmt(a.q[2], 0)} to ${fmt(b.q[2], 0)} per 100 inhabitants, ${a.yr}–${b.yr}`
    },
    note: 'Active borrowers per 100 inhabitants; bands: middle 50% and 80% of municipalities. Source: KB',
    render: () => <LibraryTrend />,
  },
]
