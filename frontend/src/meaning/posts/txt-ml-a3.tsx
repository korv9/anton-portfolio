/** Embedding maps and the philosophy atlas: scatters, bubbles, box plots, slopes and stacks. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Kpi, Legend, Svg, fmt, palette, sum, uniq } from './txt-kit'

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
}
const VARIANTS = ['baseline', 'author_centered'] as const
const d = 'ml'

function EvalSlope() {
  const data = useData<PhilSummary>('philosophy/summary.json')
  return (
    <Frame data={data}>
      {({ run }) => {
        const vs = Object.keys(run.evaluation)
        const keys = Object.keys(run.evaluation[vs[0]]).filter((k) =>
          vs.every(
            (v) =>
              typeof run.evaluation[v][k] === 'number' &&
              run.evaluation[v][k] <= 1,
          ),
        )
        const [W, H] = [300, 300]
        const y = linearScale([0, 1], [H - 14, 10])
        const x = (j: number) =>
          40 + (j * (W - 80)) / Math.max(vs.length - 1, 1)
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Clustering evaluation before and after centring by author"
            >
              {vs.map((v, j) => (
                <g key={v}>
                  <line
                    x1={x(j)}
                    x2={x(j)}
                    y1={10}
                    y2={H - 14}
                    stroke="var(--line-strong)"
                  />
                  <text
                    className="mean-txt-t"
                    x={x(j)}
                    y={H - 2}
                    textAnchor="middle"
                  >
                    {v}
                  </text>
                </g>
              ))}
              {keys.map((k, i) => (
                <g key={k}>
                  <polyline
                    points={vs
                      .map((v, j) => `${x(j)},${y(run.evaluation[v][k])}`)
                      .join(' ')}
                    fill="none"
                    stroke={color(i)}
                    strokeWidth={2}
                  />
                  {vs.map((v, j) => (
                    <circle
                      key={v}
                      cx={x(j)}
                      cy={y(run.evaluation[v][k])}
                      r={3.5}
                      fill={color(i)}
                    >
                      <title>{`${k} · ${v}: ${run.evaluation[v][k].toFixed(3)}`}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </Svg>
            <Legend
              items={keys.map((k, i) => [k.replace(/_/g, ' '), color(i)])}
            />
          </>
        )
      }}
    </Frame>
  )
}
function ClusterStacks() {
  const data = useData<Cluster[]>('philosophy/clusters.json')
  const [variant, setVariant] =
    useState<(typeof VARIANTS)[number]>('author_centered')
  return (
    <Frame data={data}>
      {(all) => {
        const rows = all
          .filter((c) => c.variant === variant)
          .sort((a, b) => b.size - a.size)
        const trad = palette(
          uniq(all.flatMap((c) => Object.keys(c.traditions))).sort(),
        )
        const [W, H, m] = [600, 260, 30]
        const yt = niceTicks(Math.max(...rows.map((c) => c.size), 1))
        const y = linearScale([0, yt.at(-1)!], [H - 4, 6])
        const bw = (W - m) / Math.max(rows.length, 1)
        return (
          <>
            <Slicer
              label="Map"
              cycles={false}
              options={VARIANTS}
              value={variant}
              onChange={setVariant}
            />
            <Svg w={W} h={H} label="Traditions inside each philosophy cluster">
              {yt.map((t) => (
                <g key={t}>
                  <line
                    className="mean-txt-grid"
                    x1={m}
                    x2={W}
                    y1={y(t)}
                    y2={y(t)}
                  />
                  <text
                    className="mean-txt-t"
                    x={m - 3}
                    y={y(t) + 3}
                    textAnchor="end"
                  >
                    {t}
                  </text>
                </g>
              ))}
              {rows.map((c, i) => {
                let acc = 0
                return Object.entries(c.traditions).map(([t, n]) => {
                  const y0 = y(acc)
                  acc += n
                  return (
                    <rect
                      key={`${c.cluster_id}${t}`}
                      x={m + i * bw + 1}
                      width={bw - 2}
                      y={y(acc)}
                      height={y0 - y(acc)}
                      fill={trad.get(t)}
                    >
                      <title>{`${c.cluster_id} · ${t}: ${n}`}</title>
                    </rect>
                  )
                })
              })}
            </Svg>
            <Legend items={[...trad]} />
          </>
        )
      }}
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
  { id: 'txt-ml-eval-slope', domain: d, render: () => <EvalSlope /> },
  {
    id: 'txt-ml-cluster-stacks',
    domain: d,
    size: 'wide',
    render: () => <ClusterStacks />,
  },
  { id: 'txt-ml-words', domain: d, render: () => <Words /> },
]
