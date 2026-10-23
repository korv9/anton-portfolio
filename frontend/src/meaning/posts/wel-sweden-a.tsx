/** Municipal Sweden: clusters, similarity, libraries and the relationships tested between them. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Legend, Svg, XTicks, extent, fmt, path, scale } from './wel-kit'

type Clusters = {
  names: Record<string, [string, string]>
  points: [string, number, number, number, string][]
}

type Groups = {
  explained_variance: number[]
  loadings: Record<string, [number, number]>
  splits: {
    k: number
    profiles: {
      group: number
      municipalities: number
      standardised_means: Record<string, number>
    }[]
  }[]
}

function ClusterMap() {
  const data = useData<Clusters>('cluster-research/municipalities.json')
  return (
    <Frame data={data}>
      {(d) => {
        const x = scale(extent(d.points.map((p) => p[1])), [14, 386])
        const y = scale(extent(d.points.map((p) => p[2])), [386, 14])
        return (
          <>
            <Svg label="Municipalities on the first two principal components, coloured by cluster">
              {d.points.map((p) => (
                <circle
                  key={p[0]}
                  cx={x(p[1])}
                  cy={y(p[2])}
                  r={5}
                  fill={color(p[3])}
                  stroke="var(--paper)"
                  strokeWidth={0.8}
                  opacity={0.9}
                >
                  <title>{p[4]}</title>
                </circle>
              ))}
            </Svg>
            <Legend items={Object.values(d.names).map((n) => n[0])} />
          </>
        )
      }}
    </Frame>
  )
}

function Scree() {
  const data = useData<Groups>('sweden/similarity/groups.json')
  return (
    <Frame data={data}>
      {(d) => {
        const v = d.explained_variance
        const w = 380 / v.length
        const y = scale([0, 1], [370, 20])
        let cum = 0
        const pts = v.map(
          (e, i) => [20 + i * w + w / 2, y((cum += e))] as [number, number],
        )
        return (
          <Svg label="Explained variance per principal component, with the cumulative line">
            {v.map((e, i) => (
              <rect
                key={i}
                x={20 + i * w + 2}
                y={y(e)}
                width={w - 4}
                height={370 - y(e)}
                rx={3}
                fill={color(i)}
              />
            ))}
            <path
              d={path(pts)}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            {pts.map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={3} fill="var(--ink)" />
            ))}
            <XTicks
              values={v.map((_, i) => i + 1)}
              x={(i) => 20 + i * w + w / 2}
              y={388}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function Biplot() {
  const data = useData<Groups>('sweden/similarity/groups.json')
  return (
    <Frame data={data}>
      {(d) => {
        const entries = Object.entries(d.loadings)
        const s = (v: number) => 200 + v * 380
        return (
          <>
            <Svg label="Indicator loadings on the first two components as arrows">
              <circle
                cx={200}
                cy={200}
                r={190}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={0.4}
              />
              {entries.map(([k, [a, b]], i) => (
                <g key={k}>
                  <line
                    x1={200}
                    y1={200}
                    x2={s(a)}
                    y2={400 - s(b)}
                    stroke={color(i)}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={s(a)} cy={400 - s(b)} r={5} fill={color(i)}>
                    <title>{`${k}: ${fmt(a, 2)}, ${fmt(b, 2)}`}</title>
                  </circle>
                </g>
              ))}
            </Svg>
            <Legend
              items={entries.map(([k]) =>
                k.replace(/_(pct|sek|days)$/, '').replace(/_/g, ' '),
              )}
            />
          </>
        )
      }}
    </Frame>
  )
}

function Profiles() {
  const data = useData<Groups>('sweden/similarity/groups.json')
  const [g, setG] = useState(0)
  return (
    <Frame data={data}>
      {(d) => {
        const split = d.splits[d.splits.length - 1]
        const p = split.profiles.find((x) => x.group === g) ?? split.profiles[0]
        const entries = Object.entries(p.standardised_means)
        const lim = Math.ceil(Math.max(...entries.map(([, v]) => Math.abs(v))))
        const x = scale([-lim, lim], [150, 390])
        const h = 380 / entries.length
        return (
          <>
            <Slicer
              label="Group"
              options={split.profiles.map((q) => q.group)}
              value={p.group}
              onChange={setG}
            />
            <Svg label="Standardised mean of each indicator for one municipality group">
              <line x1={x(0)} x2={x(0)} y1={0} y2={380} stroke="var(--muted)" />
              {entries.map(([k, v], i) => (
                <g key={k}>
                  <rect
                    x={Math.min(x(0), x(v))}
                    y={i * h + 2}
                    width={Math.abs(x(v) - x(0))}
                    height={h - 4}
                    rx={3}
                    fill={v < 0 ? color(2) : color(1)}
                  >
                    <title>{fmt(v, 2)}</title>
                  </rect>
                  <text x={146} y={i * h + h / 2 + 3} textAnchor="end">
                    {k
                      .replace(/_(pct|sek|days)$/, '')
                      .replace(/_/g, ' ')
                      .slice(0, 24)}
                  </text>
                </g>
              ))}
              <XTicks
                values={[`−${lim}σ`, '0', `+${lim}σ`]}
                x={(i) => x((i - 1) * lim)}
                y={396}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-cluster-map',
    domain: 'sweden',
    sources: ['cluster-research/municipalities.json'],
    render: () => <ClusterMap />,
  },
  {
    id: 'wel-similarity-scree',
    domain: 'sweden',
    sources: ['sweden/similarity/groups.json'],
    render: () => <Scree />,
  },
  {
    id: 'wel-similarity-biplot',
    domain: 'sweden',
    sources: ['sweden/similarity/groups.json'],
    render: () => <Biplot />,
  },
  {
    id: 'wel-similarity-profiles',
    domain: 'sweden',
    sources: ['sweden/similarity/groups.json'],
    render: () => <Profiles />,
  },
]
