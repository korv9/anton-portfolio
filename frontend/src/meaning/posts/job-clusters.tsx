/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  arc,
  CLUSTERS,
  D,
  fmt,
  Legend,
  pct,
  PREVIEW,
  sum,
  Svg,
  XLabels,
} from './job-kit'

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
type Preview = {
  points: { id: string; x: number; y: number; cluster: number }[]
}

const NOISE = 'var(--cluster-noise)'
const cc = (id: number) => (id < 0 ? NOISE : color(id))
const name = (c: Cluster) => `#${c.cluster_id} ${c.cluster_label}`
const real = (s: Summary) => s.clusters.filter((c) => c.cluster_id >= 0)

function Scatter() {
  const data = useData<Preview>(PREVIEW)
  const meta = useData<Summary>(CLUSTERS)
  const [pick, setPick] = useState('all')
  return (
    <Frame data={data}>
      {(p) => {
        const xs = p.points.map((q) => q.x),
          ys = p.points.map((q) => q.y)
        const x = linearScale([Math.min(...xs), Math.max(...xs)], [10, 790])
        const y = linearScale([Math.min(...ys), Math.max(...ys)], [370, 10])
        const ids = [...new Set(p.points.map((q) => q.cluster))].sort(
          (a, b) => a - b,
        )
        const label = (id: number) =>
          meta && !(meta instanceof Error)
            ? (meta.clusters.find((c) => c.cluster_id === id)?.cluster_label ??
              `#${id}`)
            : `#${id}`
        return (
          <>
            <Slicer
              label="Cluster"
              options={['all', ...ids.map((i) => `#${i}`)]}
              value={pick}
              onChange={setPick}
            />
            <Svg
              w={800}
              h={380}
              label="Map of 1,500 tech ads coloured by cluster"
            >
              {p.points.map((q) => (
                <circle
                  key={q.id}
                  cx={x(q.x)}
                  cy={y(q.y)}
                  r={3.2}
                  fill={cc(q.cluster)}
                  opacity={
                    pick === 'all' || pick === `#${q.cluster}` ? 0.85 : 0.08
                  }
                />
              ))}
            </Svg>
            <Legend items={ids.map((i) => [`#${i} ${label(i)}`, cc(i)])} />
          </>
        )
      }}
    </Frame>
  )
}

function Sunburst() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const total = sum(s.clusters.map((c) => c.job_count))
        const roles = [
          ...new Set(
            s.clusters.flatMap((c) => c.role_distribution.map((r) => r.label)),
          ),
        ]
        let a = 0
        const segs = s.clusters.map((c) => {
          const a0 = a
          a += (c.job_count / total) * 2 * Math.PI
          let b = a0
          const kids = c.role_distribution.map((r) => {
            const b0 = b
            b += r.share * (a - a0)
            return { r, b0, b1: b }
          })
          return { c, a0, a1: a, kids }
        })
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Sunburst of clusters and the roles inside them"
            >
              {segs.map(({ c, a0, a1, kids }) => (
                <g key={c.cluster_id}>
                  <path
                    d={arc(200, 200, 60, 128, a0, a1 - 0.006)}
                    fill={cc(c.cluster_id)}
                  >
                    <title>{`${name(c)}: ${fmt(c.job_count)} ads`}</title>
                  </path>
                  {kids.map(({ r, b0, b1 }) => (
                    <path
                      key={r.label}
                      d={arc(
                        200,
                        200,
                        132,
                        190,
                        b0,
                        Math.max(b0 + 0.001, b1 - 0.004),
                      )}
                      fill={`color-mix(in srgb, ${color(roles.indexOf(r.label) + 1)} 85%, var(--ink))`}
                    >
                      <title>{`${name(c)}, ${r.label}: ${pct(r.share, 1)}`}</title>
                    </path>
                  ))}
                </g>
              ))}
              <text
                x={200}
                y={206}
                textAnchor="middle"
                fontSize={20}
                fontWeight={700}
              >
                {fmt(total)}
              </text>
            </Svg>
            <Legend
              items={roles.map((r, i) => [
                r,
                `color-mix(in srgb, ${color(i + 1)} 85%, var(--ink))`,
              ])}
            />
          </>
        )
      }}
    </Frame>
  )
}

function Seniority() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const cs = real(s).sort((a, b) => b.senior_share - a.senior_share)
        const lim = Math.max(
          ...cs.flatMap((c) => [c.junior_share, c.senior_share]),
        )
        const x = linearScale([-lim, lim], [10, 390])
        const rowH = 34
        return (
          <>
            <Svg
              w={400}
              h={cs.length * rowH + 24}
              label="Junior and senior shares per cluster"
            >
              {cs.map((c, j) => (
                <g key={c.cluster_id}>
                  <title>{`${name(c)}: junior ${pct(c.junior_share, 1)}, senior ${pct(c.senior_share, 1)}`}</title>
                  <rect
                    x={x(-c.junior_share)}
                    y={j * rowH + 4}
                    width={x(0) - x(-c.junior_share)}
                    height={rowH - 8}
                    rx={4}
                    fill={color(4)}
                  />
                  <rect
                    x={x(0)}
                    y={j * rowH + 4}
                    width={x(c.senior_share) - x(0)}
                    height={rowH - 8}
                    rx={4}
                    fill={color(0)}
                  />
                  <circle
                    cx={x(0)}
                    cy={j * rowH + rowH / 2}
                    r={5}
                    fill={cc(c.cluster_id)}
                    stroke="var(--paper)"
                  />
                </g>
              ))}
              <XLabels
                y={cs.length * rowH + 16}
                items={[-lim, 0, lim].map((v) => ({
                  x: x(v),
                  label: pct(Math.abs(v)),
                }))}
              />
            </Svg>
            <Legend
              items={[
                ['junior', color(4)],
                ['senior', color(0)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'job-cluster-map', domain: D, size: 'wide', render: () => <Scatter /> },
  { id: 'job-cluster-sunburst', domain: D, render: () => <Sunburst /> },
  { id: 'job-cluster-seniority', domain: D, render: () => <Seniority /> },
]
