/** Municipal Sweden: clusters, similarity, libraries and the relationships tested between them. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
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
    x: { name: string }
    y: { name: string }
    result: { rho?: number; points?: [string, number, number][] }
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
  rows: {
    code: string
    year: number
    visits_rate: number | null
    active_borrowers_rate: number | null
    activities_rate: number | null
    service_points_rate: number | null
  }[]
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

function Relations() {
  const data = useData<Connections>('sweden/connections/connections.json')
  const [i, setI] = useState(0)
  return (
    <Frame data={data}>
      {(d) => {
        // Only the relationships tested on municipality points can be drawn as a scatter.
        const rels = d.relationships.filter((r) => r.result.points?.length)
        const r = rels[i] ?? rels[0]
        if (!r) return null
        const pts = r.result.points!.filter((p) => num(p[1]) && num(p[2]))
        const x = scale(extent(pts.map((p) => p[1])), [20, 380])
        const y = scale(extent(pts.map((p) => p[2])), [370, 20])
        return (
          <>
            <Slicer
              label="Relationship"
              cycles={false}
              options={rels.map((_, j) => j)}
              format={(j) => `${rels[j].x.name} against ${rels[j].y.name}`}
              value={i}
              onChange={setI}
            />
            <Svg label={`${r.x.name} against ${r.y.name}`}>
              {pts.map((p) => (
                <circle
                  key={p[0]}
                  cx={x(p[1])}
                  cy={y(p[2])}
                  r={3.5}
                  fill={color(i)}
                  opacity={0.7}
                />
              ))}
              <text
                x={380}
                y={30}
                textAnchor="end"
                style={{ fontSize: 30, fill: 'var(--ink)' }}
              >
                ρ {num(r.result.rho) ? fmt(r.result.rho, 3) : '–'}
              </text>
            </Svg>
            <p className="mean-legend">
              Across: {r.x.name}. Up: {r.y.name}.
            </p>
          </>
        )
      }}
    </Frame>
  )
}

function LibraryMap() {
  const data = useData<Libraries>('sweden/belonging/libraries.json')
  return (
    <Frame data={data}>
      {(d) => {
        const libs = d.libraries.filter((l) => num(l.x) && num(l.y))
        const [x0, x1] = extent(libs.map((l) => l.x!))
        const [y0, y1] = extent(libs.map((l) => l.y!))
        const k = Math.min(380 / (x1 - x0), 780 / (y1 - y0))
        const types = [...new Set(libs.map((l) => l.type))]
        return (
          <>
            <Svg
              w={400}
              h={800}
              label="Every public library in Sweden as a dot"
            >
              {libs.map((l, i) => (
                <circle
                  key={i}
                  cx={10 + (l.x! - x0) * k}
                  cy={790 - (l.y! - y0) * k}
                  r={2.4}
                  fill={color(types.indexOf(l.type))}
                  opacity={0.8}
                />
              ))}
            </Svg>
            <Legend items={types} />
          </>
        )
      }}
    </Frame>
  )
}

function LibraryTrend() {
  const data = useData<Belonging>('sweden/belonging/municipalities.json')
  const [m, setM] = useState<Rate>('active_borrowers_rate')
  return (
    <Frame data={data}>
      {(d) => {
        const by = [
          ...groupBy(
            d.rows.filter((r) => num(r[m])),
            (r) => r.year,
          ),
        ].sort((a, b) => a[0] - b[0])
        const qs = by.map(([yr, list]) => {
          const v = list.map((r) => r[m]!).sort((a, b) => a - b)
          const q = (p: number) => v[Math.floor(p * (v.length - 1))]
          return { yr, q: [q(0.1), q(0.25), q(0.5), q(0.75), q(0.9)] }
        })
        const top = Math.max(...qs.map((q) => q.q[4]))
        const x = scale([0, qs.length - 1], [30, 390])
        const y = scale([0, top], [370, 20])
        const bandPath = (a: number, b: number) =>
          `${path(qs.map((q, i) => [x(i), y(q.q[a])]))}L${path(qs.map((q, i) => [x(i), y(q.q[b])] as [number, number]).reverse()).slice(1)}Z`
        return (
          <>
            <Slicer
              label="Rate"
              cycles={false}
              options={
                [
                  'active_borrowers_rate',
                  'visits_rate',
                  'activities_rate',
                  'service_points_rate',
                ] as const
              }
              format={(k) => LIBRARY_RATES[k]}
              value={m}
              onChange={setM}
            />
            <Svg label="Municipal library rates, median with 50 and 80 percent bands">
              <path d={bandPath(0, 4)} fill={color(2)} opacity={0.5} />
              <path d={bandPath(1, 3)} fill={color(4)} />
              <path
                d={path(qs.map((q, i) => [x(i), y(q.q[2])]))}
                fill="none"
                stroke={color(0)}
                strokeWidth={3}
              />
              <XTicks
                values={qs.map((q, i) => (i % 3 ? '' : q.yr))}
                x={x}
                y={392}
              />
            </Svg>
            <Legend
              items={['p10–p90', 'p25–p75', 'median']}
              colors={[color(2), color(4), color(0)]}
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
    render: () => <LibraryMap />,
  },
  {
    id: 'wel-connections-scatter',
    domain: 'sweden',
    sources: ['sweden/connections/connections.json'],
    title: 'Municipal indicators set against each other',
    render: () => <Relations />,
  },
  {
    id: 'wel-library-bands',
    domain: 'sweden',
    sources: ['sweden/belonging/municipalities.json'],
    title: 'Library use across municipalities: median and spread',
    render: () => <LibraryTrend />,
  },
]
