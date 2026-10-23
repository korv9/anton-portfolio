/** Jobs: the two shapes occupations' demand took, from clusters/demand-curves.json. */
import { focal, Frame, OTHER, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, yearTicks } from '../../charts/scales'
import { D, linePath, Svg, XLabels } from './job-kit'

type Curve = {
  id: number
  size: number
  medoid: number[]
  p10: number[]
  p90: number[]
}
type Demand = {
  method: { trend_months: string[] }
  diagnostics: { n: number }
  clusters: Curve[]
}

const DEMAND = 'clusters/demand-curves.json'

/** Rising or falling, read from where the typical curve ends against where it starts. */
const way = (c: Curve) =>
  (c.medoid.at(-1) ?? 0) >= (c.medoid[0] ?? 0) ? 'rising' : 'falling'
const bySize = (d: Demand) => [...d.clusters].sort((a, b) => b.size - a.size)

function DemandShapes() {
  return (
    <Frame data={useData<Demand>(DEMAND)}>
      {(d) => {
        const months = d.method.trend_months
        const curves = bySize(d)
        if (months.length < 2 || !curves.length) return null
        const L = 30,
          R = 470,
          T = 10,
          B = 192
        const all = curves.flatMap((c) => [...c.p10, ...c.p90])
        const lim = Math.ceil(Math.max(...all.map(Math.abs)))
        const x = linearScale([0, months.length - 1], [L, R])
        const y = linearScale([-lim, lim], [B, T])
        const pts = (v: number[]) =>
          v.map((n, i) => [x(i), y(n)] as [number, number])
        return (
          <Svg
            w={600}
            h={220}
            label="Typical demand trend of each occupation cluster, with the 10th to 90th percentile band"
          >
            <YAxis
              y={y}
              ticks={[-lim, 0, lim]}
              x0={L}
              x1={R}
              format={(v) => (v > 0 ? `+${v}` : String(v).replace('-', '−'))}
            />
            {[...curves].reverse().map((c) => {
              const on = c === curves[0]
              const top = pts(c.p90)
              const bottom = pts(c.p10).reverse()
              return (
                <g key={c.id}>
                  <path
                    d={`${linePath(top)}${linePath(bottom).replace('M', 'L')}Z`}
                    fill={focal(on)}
                    fillOpacity={0.14}
                  />
                  <path
                    d={linePath(pts(c.medoid))}
                    fill="none"
                    stroke={on ? focal(true) : OTHER}
                    strokeWidth={on ? 2.5 : 2}
                  />
                </g>
              )
            })}
            <EndLabels
              x={R + 6}
              top={T}
              bottom={B}
              items={curves.map((c, i) => ({
                y: y(c.medoid.at(-1) ?? 0),
                label: `${c.size} ${way(c)}`,
                color: i ? 'var(--mean-muted)' : focal(true),
              }))}
            />
            <XLabels
              y={216}
              items={yearTicks(months).map((t) => ({
                x: x(t.index),
                label: t.label,
              }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-demand-shapes',
    domain: D,
    sources: ['clusters/demand-curves.json'],
    size: 'wide',
    title: (d: Demand) => {
      const [big, small] = bySize(d)
      return big && small && way(big) !== way(small)
        ? `${big.size} of ${d.diagnostics.n} occupation groups follow a rising curve in their share of job ads since 2023; ${small.size} follow a falling one`
        : 'Two shapes of demand across occupation groups'
    },
    note: 'Trend of each group’s share of job ads, scaled per group (standard deviations); line: typical group, band: 10th–90th percentile. Arbetsförmedlingen, 2023–2026',
    render: () => <DemandShapes />,
  },
]
