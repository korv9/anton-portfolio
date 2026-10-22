/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { color, focal, Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { arc, CLUSTERS, D, fmt, KpiGrid, pct, Svg, XLabels } from './job-kit'

type Share = { label: string; count: number; share: number }
type Cluster = {
  cluster_id: number
  cluster_label: string
  job_count: number
  junior_share: number
  senior_share: number
  role_distribution: Share[]
  years: Share[]
  top_skills: { skill: string; count: number; lift: number }[]
}
type Summary = {
  source_size: number
  candidate_count: number
  unique_text_count: number
  diagnostics: {
    cluster_count: number
    noise_share: number
    silhouette: number
    trustworthiness: number
    feature_trustworthiness: number
    mean_cluster_probability: number
  }
  clusters: Cluster[]
}
const NOISE = 'var(--cluster-noise)'
const cc = (id: number) => (id < 0 ? NOISE : color(id))
const name = (c: Cluster) => `#${c.cluster_id} ${c.cluster_label}`
const real = (s: Summary) => s.clusters.filter((c) => c.cluster_id >= 0)

function YearHeat() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const cs = real(s)
        const years = [
          ...new Set(cs.flatMap((c) => c.years.map((y) => y.label))),
        ].sort()
        const cell = 340 / years.length,
          rowH = 340 / cs.length
        return (
          <Svg w={400} h={380} label="Heatmap of each cluster's ads by year">
            {cs.map((c, j) => (
              <g key={c.cluster_id}>
                <circle
                  cx={30}
                  cy={j * rowH + rowH / 2}
                  r={8}
                  fill={cc(c.cluster_id)}
                />
                {years.map((yr, i) => {
                  const sh = c.years.find((y) => y.label === yr)?.share ?? 0
                  return (
                    <rect
                      key={yr}
                      x={50 + i * cell + 1}
                      y={j * rowH + 1}
                      width={cell - 2}
                      height={rowH - 2}
                      rx={4}
                      fill={`color-mix(in srgb, ${color(1)} ${Math.round(sh * 220)}%, var(--paper))`}
                    >
                      <title>{`#${c.cluster_id} ${yr}: ${pct(sh, 1)}`}</title>
                    </rect>
                  )
                })}
              </g>
            ))}
            <XLabels
              y={370}
              items={years.map((yr, i) => ({
                x: 50 + i * cell + cell / 2,
                label: yr,
              }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function Gauges() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const g = s.diagnostics
        // Silhouette is the headline score, so it alone takes the focal colour; each gauge is
        // named under its arc, so no legend is needed.
        const items: [string, number][] = [
          ['silhouette', g.silhouette],
          ['trustworthiness', g.trustworthiness],
          ['feature trustworthiness', g.feature_trustworthiness],
          ['mean membership', g.mean_cluster_probability],
        ]
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Gauges of clustering quality diagnostics"
            >
              {items.map(([k, v], i) => {
                const cx = 100 + (i % 2) * 200,
                  cy = 120 + Math.floor(i / 2) * 190
                const a0 = -0.75 * Math.PI,
                  span = 1.5 * Math.PI
                return (
                  <g key={k}>
                    <title>{`${k}: ${v.toFixed(3)}`}</title>
                    <path
                      d={arc(cx, cy, 58, 80, a0, a0 + span)}
                      fill="var(--wash)"
                    />
                    <path
                      d={arc(
                        cx,
                        cy,
                        58,
                        80,
                        a0,
                        a0 + span * Math.max(0, Math.min(1, v)),
                      )}
                      fill={focal(i === 0)}
                    />
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      fontSize={24}
                      fontWeight={700}
                    >
                      {v.toFixed(2)}
                    </text>
                    <text x={cx} y={cy + 66} textAnchor="middle" fontSize={14}>
                      {k}
                    </text>
                  </g>
                )
              })}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function Kpis() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => (
        <KpiGrid
          items={[
            [fmt(s.candidate_count), 'candidate ads'],
            [fmt(s.source_size), 'ads clustered'],
            [fmt(s.unique_text_count), 'unique texts'],
            [String(s.diagnostics.cluster_count), 'clusters'],
            [pct(s.diagnostics.noise_share, 1), 'noise'],
            [
              fmt(Math.max(...s.clusters.map((c) => c.job_count))),
              'ads, largest group',
            ],
          ]}
        />
      )}
    </Frame>
  )
}

function Bubbles() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const cs = real(s)
        const mx = Math.max(...cs.map((c) => c.junior_share)),
          my = Math.max(...cs.map((c) => c.senior_share))
        const x = linearScale([0, mx * 1.1], [40, 380]),
          y = linearScale([0, my * 1.1], [360, 20])
        const big = Math.max(...cs.map((c) => c.job_count))
        return (
          <Svg
            w={400}
            h={400}
            label="Bubbles of clusters by junior and senior share, sized by ads"
          >
            {cs.map((c) => (
              <circle
                key={c.cluster_id}
                cx={x(c.junior_share)}
                cy={y(c.senior_share)}
                r={8 + 40 * Math.sqrt(c.job_count / big)}
                fill={cc(c.cluster_id)}
                opacity={0.8}
                stroke="var(--paper)"
                strokeWidth={2}
              >
                <title>{`${name(c)}: ${fmt(c.job_count)} ads`}</title>
              </circle>
            ))}
            <XLabels
              y={392}
              items={[0, mx].map((v) => ({
                x: x(v),
                label: `junior ${pct(v)}`,
              }))}
            />
            <text x={36} y={y(my) + 4} textAnchor="end" fontSize={9}>
              {pct(my)}
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'job-cluster-kpis', domain: D, render: () => <Kpis /> },
  { id: 'job-cluster-years', domain: D, render: () => <YearHeat /> },
  { id: 'job-cluster-gauges', domain: D, render: () => <Gauges /> },
  { id: 'job-cluster-bubbles', domain: D, render: () => <Bubbles /> },
]
