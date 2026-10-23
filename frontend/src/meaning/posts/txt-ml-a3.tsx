/** Embedding maps and the philosophy atlas: scatters, bubbles, box plots, slopes and stacks. */
import { useState } from 'react'
import { Frame, OTHER, PALETTE, Slicer, useData, type Post } from '../kit'
import { EndLabels, RefLine, XAxis, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { Bars, Kpi, Svg, fmt, sum } from './txt-kit'

type Work = {
  document_id: string
  author: string
  year: number
  tradition: string
  passages: number
  words: number
}
type PhilSummary = {
  works: Work[]
  run: { evaluation: Record<string, Record<string, number>> }
}
type Cluster = {
  variant: string
  cluster_id: number
  size: number
  traditions: Record<string, number>
  distinctive_terms: string[]
}
const VARIANTS = ['baseline', 'author_centered'] as const
const d = 'ml'

/** Three measures before and after centring, with plain names; the first is focal. */
const MEASURES: [string, string][] = [
  ['same_work_neighbours', 'Same-work neighbours'],
  ['mean_largest_work_share', 'Largest work share'],
  ['noise_share', 'Unclustered'],
]
const pc = (v: number) => `${Math.round(v * 100)}%`

function EvalSlope() {
  const data = useData<PhilSummary>('philosophy/summary.json')
  return (
    <Frame data={data}>
      {({ run }) => {
        const vs = ['baseline', 'author_centered'].filter(
          (v) => run.evaluation[v],
        )
        const [W, H, l, r, top, bottom] = [300, 230, 40, 150, 12, 20]
        const y = linearScale([0, 1], [H - bottom, top])
        const x = (j: number) => l + j * (W - l - r)
        const ev = (v: string, k: string) => run.evaluation[v][k]
        const chance = ev(vs[0], 'same_work_chance')
        return (
          <Svg
            w={W}
            h={H}
            label="Clustering measures before and after centring passages by author"
          >
            <YAxis
              y={y}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              x0={l}
              x1={x(1)}
              format={pc}
            />
            <XAxis
              x={x}
              y={H - 4}
              ticks={[
                { value: 0, label: 'as embedded' },
                { value: 1, label: 'by author' },
              ]}
            />
            <RefLine
              y={y(chance)}
              x0={l}
              x1={x(1)}
              label={`chance ${pc(chance)}`}
            />
            {MEASURES.map(([k], i) => (
              <g key={k}>
                <line
                  x1={x(0)}
                  x2={x(1)}
                  y1={y(ev(vs[0], k))}
                  y2={y(ev(vs[1], k))}
                  stroke={i ? OTHER : PALETTE[0]}
                  strokeWidth={i ? 1.5 : 2.2}
                />
                {vs.map((v, j) => (
                  <circle
                    key={v}
                    cx={x(j)}
                    cy={y(ev(v, k))}
                    r={3}
                    fill={i ? OTHER : PALETTE[0]}
                  >
                    <title>{`${MEASURES[i][1]}, ${v}: ${pc(ev(v, k))}`}</title>
                  </circle>
                ))}
              </g>
            ))}
            <EndLabels
              x={x(1) + 6}
              top={top}
              bottom={H - bottom}
              items={MEASURES.map(([k, name], i) => ({
                y: y(ev(vs[1], k)),
                label: `${name} ${pc(ev(vs[1], k))}`,
                color: i ? undefined : PALETTE[0],
              }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}
/** Each cluster's largest tradition and its share, largest share first. */
const purity = (all: Cluster[], variant: string) =>
  all
    .filter((c) => c.variant === variant)
    .map((c) => {
      const [t, n] = Object.entries(c.traditions).sort((a, b) => b[1] - a[1])[0]
      return { c, t, share: n / c.size }
    })
    .sort((a, b) => b.share - a.share)

function ClusterStacks() {
  const data = useData<Cluster[]>('philosophy/clusters.json')
  const [variant, setVariant] =
    useState<(typeof VARIANTS)[number]>('author_centered')
  return (
    <Frame data={data}>
      {(all) => (
        <>
          <Slicer
            label="Map"
            cycles={false}
            options={VARIANTS}
            format={(v) => (v === 'baseline' ? 'As embedded' : 'By author')}
            value={variant}
            onChange={setVariant}
          />
          <Bars
            label="Share of each cluster's passages from its largest tradition"
            format={pc}
            max={1}
            rows={purity(all, variant).map(({ c, t, share }) => ({
              key: String(c.cluster_id),
              label: c.distinctive_terms.slice(0, 3).join(', '),
              value: share,
              text: `${pc(share)} ${t.replace(/-/g, ' ')}`,
              ref: 0.5,
            }))}
          />
        </>
      )}
    </Frame>
  )
}
function Words() {
  const data = useData<PhilSummary>('philosophy/summary.json')
  return (
    <Frame data={data}>
      {(d) => (
        <Kpi
          value={fmt(sum(d.works.map((w) => w.words)))}
          unit="words of philosophy"
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-eval-slope',
    domain: d,
    sources: ['philosophy/summary.json'],
    title: ({ run: { evaluation: e } }: PhilSummary) =>
      `Centring by author cut same-work neighbours from ${pc(e.baseline.same_work_neighbours)} to ${pc(e.author_centered.same_work_neighbours)}; chance is ${pc(e.baseline.same_work_chance)}`,
    note: "Share of each passage's nearest neighbours from the same work, and two cluster measures, before and after",
    render: () => <EvalSlope />,
  },
  {
    id: 'txt-ml-cluster-stacks',
    domain: d,
    sources: ['philosophy/clusters.json'],
    title: (all: Cluster[]) => {
      const rows = purity(all, 'author_centered')
      return `In ${rows.filter((r) => r.share > 0.5).length} of ${rows.length} clusters one tradition makes up more than half`
    },
    note: "Each cluster's largest tradition, as a share of its passages; clusters named by distinctive words; tick at 50%",
    render: () => <ClusterStacks />,
  },
  {
    id: 'txt-ml-words',
    domain: d,
    sources: ['philosophy/summary.json'],
    render: () => <Words />,
  },
]
