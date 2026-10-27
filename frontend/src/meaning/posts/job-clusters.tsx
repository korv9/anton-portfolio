/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { useState } from 'react'
import { focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  Bars,
  clusterLabel,
  CLUSTERS,
  D,
  fmt,
  maxOf,
  minOf,
  pct,
  PREVIEW,
  Svg,
} from './job-kit'
import { l } from '../../i18n'

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
  diagnostics: { noise_share: number }
  clusters: Cluster[]
}
type Preview = {
  points: { id: string; x: number; y: number; cluster: number }[]
}

/** Two clusters share a label, so the number keeps them apart. */
const name = (c: Cluster) => `#${c.cluster_id} ${clusterLabel(c.cluster_label)}`
/** The notes' shared tail: one run, and the share of ads it leaves unassigned. */
const oneRun = (s: Summary) =>
  l(
    `one clustering run, ${pct(s.diagnostics.noise_share, 1)} of ads unassigned`,
    `en klustringskörning, ${pct(s.diagnostics.noise_share, 1)} av annonserna utan kluster`,
  )
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
            const picked = order.find((c) => c.cluster_id === on)
            return (
              <>
                <Slicer
                  label={l('Cluster', 'Kluster')}
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
                  label={l(
                    `Map of ${fmt(p.points.length)} tech ads, ${picked ? name(picked) : ''} highlighted`,
                    `Karta över ${fmt(p.points.length)} techannonser, ${picked ? name(picked) : ''} markerat`,
                  )}
                >
                  {/* Grey points first, the picked cluster on top; the caption names it, as a
                      label on the points would sit on top of them. */}
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
            label: l('Unassigned', 'Ej tilldelade'),
            value: noise.job_count,
            color: OTHER,
          })
        return (
          <Bars
            n={11}
            label={l('Tech job ads per cluster', 'Techannonser per kluster')}
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
          label={l(
            'Senior share minus junior share of ads per cluster',
            'Andel annonser för seniora minus andel för juniora, per kluster',
          )}
          format={(v) =>
            `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} ${l('pt', 'p.e.')}`
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
    sources: ['jobs/cluster-summary.json', 'jobs/cluster-preview.json'],
    size: 'wide',
    title: [
      'Tech job ads placed by how alike their texts read',
      'Techannonser placerade efter hur lika deras texter är',
    ],
    note: (s: Summary) =>
      l(
        `A sample of ads projected to two dimensions (UMAP), so the axes have no unit; one cluster highlighted at a time; ${oneRun(s)}`,
        `Ett urval annonser projicerade till två dimensioner (UMAP), så axlarna saknar enhet; ett kluster markeras i taget; ${oneRun(s)}`,
      ),
    render: () => <Scatter />,
  },
  {
    id: 'job-cluster-sunburst',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    title: (s: Summary) => {
      const c = bySize(s)[0]
      return c && s.source_size
        ? l(
            `The largest cluster, ${c.cluster_label}, holds ${pct(c.job_count / s.source_size)} of the tech ads`,
            `Det största klustret, ${clusterLabel(c.cluster_label)}, rymmer ${pct(c.job_count / s.source_size)} av techannonserna`,
          )
        : l('Tech job ads per cluster', 'Techannonser per kluster')
    },
    note: (s: Summary) =>
      l(
        `Ads per cluster; ${oneRun(s)} (they fit no cluster)`,
        `Annonser per kluster; ${oneRun(s)} (de passar inget kluster)`,
      ),
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
        ? l(
            `In ${n} of ${cs.length} clusters, a larger share of ads ask for seniors than for juniors`,
            `I ${n} av ${cs.length} kluster söker en större andel av annonserna seniora än juniora`,
          )
        : l(
            'Senior and junior shares of ads per cluster',
            'Andel annonser för seniora och juniora per kluster',
          )
    },
    note: (s: Summary) =>
      l(
        `Senior share minus junior share of each cluster's ads, in percentage points; ${oneRun(s)}`,
        `Andel annonser för seniora minus andel för juniora i varje kluster, i procentenheter; ${oneRun(s)}`,
      ),
    render: () => <Seniority />,
  },
]
