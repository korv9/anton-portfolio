/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { useState } from 'react'
import { focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  Bars,
  CLUSTERS,
  D,
  fmt,
  maxOf,
  minOf,
  pct,
  PREVIEW,
  sum,
  Svg,
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
  clusters: Cluster[]
}
type Preview = {
  points: { id: string; x: number; y: number; cluster: number }[]
}

/** Two clusters share a label, so the number keeps them apart. */
const name = (c: Cluster) => `#${c.cluster_id} ${c.cluster_label}`
const real = (s: Summary) => s.clusters.filter((c) => c.cluster_id >= 0)
/** Clusters by size, largest first. */
const bySize = (s: Summary) =>
  [...real(s)].sort((a, b) => b.job_count - a.job_count)
/** Senior minus junior share: above zero, the cluster's ads ask for seniors more often. */
const tilt = (c: Cluster) => c.senior_share - c.junior_share

function Scatter() {
  const data = useData<Preview>(PREVIEW)
  const meta = useData<Summary>(CLUSTERS)
  const [pick, setPick] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(p) => (
        <Frame data={meta}>
          {(s) => {
            const order = bySize(s)
            const on = pick ?? order[0]?.cluster_id
            if (on == null || !p.points.length) return null
            const W = 600,
              H = 240
            const xs = p.points.map((q) => q.x),
              ys = p.points.map((q) => q.y)
            const x = linearScale([minOf(xs), maxOf(xs)], [8, W - 8])
            const y = linearScale([minOf(ys), maxOf(ys)], [H - 8, 8])
            const mine = p.points.filter((q) => q.cluster === on)
            const n = mine.length || 1
            const cx = sum(mine.map((q) => x(q.x))) / n
            const cy = sum(mine.map((q) => y(q.y))) / n
            const picked = order.find((c) => c.cluster_id === on)
            return (
              <>
                <Slicer
                  label="Cluster"
                  options={order.map((c) => c.cluster_id)}
                  format={(id) => {
                    const c = order.find((k) => k.cluster_id === id)
                    return c ? name(c) : `#${id}`
                  }}
                  value={on}
                  onChange={setPick}
                />
                {picked && <p className="mean-cap">{name(picked)}</p>}
                <Svg
                  w={W}
                  h={H}
                  label={`Map of ${fmt(p.points.length)} tech ads, ${picked ? name(picked) : ''} highlighted`}
                >
                  {/* Grey points first, the picked cluster on top. */}
                  {[false, true].map((top) =>
                    p.points
                      .filter((q) => (q.cluster === on) === top)
                      .map((q) => (
                        <circle
                          key={q.id}
                          cx={x(q.x)}
                          cy={y(q.y)}
                          r={2.4}
                          fill={focal(top)}
                          opacity={top ? 0.9 : 0.5}
                        />
                      )),
                  )}
                  {picked && (
                    <text
                      className="mean-job-v"
                      x={Math.min(W - 70, Math.max(70, cx))}
                      y={cy + 4}
                      textAnchor="middle"
                      stroke="var(--paper)"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {name(picked)}
                    </text>
                  )}
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function Sizes() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const noise = s.clusters.find((c) => c.cluster_id < 0)
        const rows = bySize(s).map((c, j) => ({
          key: String(c.cluster_id),
          label: name(c),
          value: c.job_count,
          color: focal(j === 0),
        }))
        if (noise)
          rows.push({
            key: 'noise',
            label: 'Unassigned',
            value: noise.job_count,
            color: OTHER,
          })
        return (
          <Bars
            n={11}
            label="Tech job ads per cluster"
            format={fmt}
            rows={rows}
          />
        )
      }}
    </Frame>
  )
}

function Seniority() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => (
        <Bars
          n={11}
          label="Senior share minus junior share of ads per cluster"
          format={(v) =>
            `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} pt`
          }
          rows={real(s)
            .sort((a, b) => tilt(b) - tilt(a))
            .map((c) => ({
              key: String(c.cluster_id),
              label: name(c),
              value: tilt(c),
              color: focal(tilt(c) < 0),
            }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-cluster-map',
    domain: D,
    sources: ['jobs/cluster-preview.json', 'jobs/cluster-summary.json'],
    size: 'wide',
    title: 'Tech job ads placed by how alike their texts read',
    note: 'A sample of ads projected to two dimensions (UMAP), so the axes have no unit; one cluster highlighted at a time',
    render: () => <Scatter />,
  },
  {
    id: 'job-cluster-sunburst',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    title: (s: Summary) => {
      const c = bySize(s)[0]
      return c && s.source_size
        ? `The largest cluster, ${c.cluster_label}, holds ${pct(c.job_count / s.source_size)} of the tech ads`
        : 'Tech job ads per cluster'
    },
    note: 'Ads per cluster; unassigned ads fit no cluster',
    render: () => <Sizes />,
  },
  {
    id: 'job-cluster-seniority',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    title: (s: Summary) => {
      const cs = real(s)
      const n = cs.filter((c) => tilt(c) > 0).length
      return cs.length
        ? `In ${n} of ${cs.length} clusters, a larger share of ads ask for seniors than for juniors`
        : 'Senior and junior shares of ads per cluster'
    },
    note: "Senior share minus junior share of each cluster's ads, in percentage points",
    render: () => <Seniority />,
  },
]
