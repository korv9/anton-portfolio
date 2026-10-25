/** The philosophy atlas evaluation: measures before and after centring, and cluster mix. */
import { useState } from 'react'
import { Frame, OTHER, PALETTE, Slicer, useData, type Post } from '../kit'
import { EndLabels, RefLine, XAxis, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { Bars, Svg, heading, usable } from './txt-kit'

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
const MAP_NAME = {
  baseline: 'As embedded',
  author_centered: 'Author style removed',
}
const SUMMARY = 'philosophy/summary.json'
const CLUSTERS = 'philosophy/clusters.json'
const d = 'ml'

/** Three measures before and after centring, with plain names and the short ones the line
 * ends carry; the first is focal. */
const MEASURES: [string, string, string][] = [
  ['same_work_neighbours', 'Same-work neighbours', 'Same work'],
  ['mean_largest_work_share', 'Largest work share', 'Largest work'],
  ['noise_share', 'Unclustered', 'Unclustered'],
]
const pc = (v: number) => `${Math.round(v * 100)}%`
/** Both maps carry every measure the slope draws, and the chance level. */
const complete = ({ run }: PhilSummary) =>
  VARIANTS.every((v) =>
    [...MEASURES.map(([k]) => k), 'same_work_chance'].every((k) =>
      Number.isFinite(run.evaluation[v]?.[k]),
    ),
  )

function EvalSlope() {
  const data = usable(useData<PhilSummary>(SUMMARY), SUMMARY, complete)
  return (
    <Frame data={data}>
      {({ run }) => {
        const vs = VARIANTS
        const [W, H, l, r, top, bottom] = [300, 190, 40, 100, 12, 20]
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
              y={H + 8}
              ticks={[
                { value: 0, label: 'embedded' },
                { value: 1, label: 'style removed' },
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
              items={MEASURES.map(([k, , name], i) => ({
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
      const [t, n] = Object.entries(c.traditions).sort(
        (a, b) => b[1] - a[1],
      )[0] ?? ['', 0]
      return { c, t, share: n / c.size }
    })
    .filter((r) => r.t && r.c.size > 0)
    .sort((a, b) => b.share - a.share)

function ClusterStacks() {
  const [variant, setVariant] =
    useState<(typeof VARIANTS)[number]>('author_centered')
  const data = usable(
    useData<Cluster[]>(CLUSTERS),
    CLUSTERS,
    (all) => purity(all, variant).length,
  )
  return (
    <Frame data={data}>
      {(all) => (
        <>
          <Slicer
            label="Map"
            cycles={false}
            options={VARIANTS}
            format={(v) => MAP_NAME[v]}
            value={variant}
            onChange={setVariant}
          />
          <p className="mean-cap">{MAP_NAME[variant]}</p>
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
export const posts: Post[] = [
  {
    id: 'txt-ml-eval-slope',
    domain: d,
    sources: ['philosophy/summary.json'],
    title: heading((sum: PhilSummary) => {
      if (!complete(sum)) return ''
      const e = sum.run.evaluation
      return `Same-work neighbours: ${pc(e.baseline.same_work_neighbours)} as embedded, ${pc(e.author_centered.same_work_neighbours)} with author style removed; chance ${pc(e.baseline.same_work_chance)}`
    }),
    note: "Share of each passage's nearest neighbours from the same work, and two cluster measures, before and after",
    render: () => <EvalSlope />,
  },
  {
    id: 'txt-ml-cluster-stacks',
    domain: d,
    sources: ['philosophy/clusters.json'],
    // Both maps in one sentence, so the title holds whichever one the slicer shows.
    title: heading((all: Cluster[]) => {
      const [after, before] = (['author_centered', 'baseline'] as const).map(
        (v) => purity(all, v),
      )
      const half = (rows: typeof after) =>
        rows.filter((r) => r.share > 0.5).length
      return after.length && before.length
        ? `Over half one tradition: ${half(after)} of ${after.length} clusters without author style, ${half(before)} of ${before.length} with it`
        : ''
    }),
    note: "Each cluster's largest tradition, as a share of its passages; clusters named by distinctive words; tick at 50%",
    render: () => <ClusterStacks />,
  },
]
