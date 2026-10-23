/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { CLUSTERS, D, fmt, Svg, XLabels } from './job-kit'

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
const real = (s: Summary) => s.clusters.filter((c) => c.cluster_id >= 0)

function Skills() {
  const data = useData<Summary>(CLUSTERS)
  const [pick, setPick] = useState('#6')
  return (
    <Frame data={data}>
      {(s) => {
        const cs = real(s)
        const c = cs.find((k) => `#${k.cluster_id}` === pick) ?? cs[0]
        const rows = [...c.top_skills].sort((a, b) => b.lift - a.lift)
        const x = linearScale(
          [0, Math.max(...rows.map((r) => r.lift))],
          [110, 380],
        )
        const rowH = 300 / Math.max(rows.length, 1)
        return (
          <>
            <Slicer
              label="Cluster"
              options={cs.map((k) => `#${k.cluster_id}`)}
              format={(v) =>
                v === 'all' ? 'All clusters' : `Cluster ${v.slice(1)}`
              }
              value={pick}
              onChange={setPick}
            />
            <Svg
              w={400}
              h={330}
              label="Dot plot of each cluster's most distinctive skills by lift"
            >
              <line
                x1={x(1)}
                x2={x(1)}
                y1={0}
                y2={300}
                stroke="var(--line-strong)"
                strokeDasharray="3 3"
              />
              {rows.map((r, j) => (
                <g key={r.skill}>
                  <title>{`${r.skill}: lift ${r.lift.toFixed(1)}×, ${fmt(r.count)} ads`}</title>
                  <text
                    x={104}
                    y={j * rowH + rowH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                  >
                    {r.skill}
                  </text>
                  <line
                    x1={110}
                    x2={380}
                    y1={j * rowH + rowH / 2}
                    y2={j * rowH + rowH / 2}
                    stroke="var(--line)"
                  />
                  <circle
                    cx={x(r.lift)}
                    cy={j * rowH + rowH / 2}
                    r={4 + Math.sqrt(r.count) / 3}
                    fill={cc(c.cluster_id)}
                    stroke="var(--ink)"
                    strokeWidth={0.5}
                  />
                </g>
              ))}
              <XLabels
                y={322}
                items={[1, Math.round(rows[0]?.lift ?? 1)].map((v) => ({
                  x: x(v),
                  label: `${v}×`,
                }))}
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
    id: 'job-cluster-skills',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    render: () => <Skills />,
  },
]
