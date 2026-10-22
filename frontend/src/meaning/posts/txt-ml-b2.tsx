/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, fmt, uniq } from './txt-kit'

type SymSummary = {
  document_count: number
  occurrence_count: number
  point_count: number
  symbol_count: number
  cluster_count: number
  symbols: { id: string; label: string; points: number; occurrences: number }[]
  documents: { id: string; title: string; tradition: string; words: number }[]
  evaluation: { cluster_sizes: Record<string, number> }
}
type Steps = {
  steps: { id: string; name: string; metrics: Record<string, number> }[]
}
type Profile = { concept_id: string; corpus_id: string; rank1_lift: number }
const SYM = 'symbolic/summary.json'
const mix = (c: string, p: number) =>
  `color-mix(in srgb, ${c} ${Math.round(p)}%, var(--paper))`

function ResearchSteps() {
  const data = useData<Steps>('symbolic/research-history.json')
  const [metric, setMetric] = useState('noise_share')
  return (
    <Frame data={data}>
      {({ steps }) => {
        const keys = uniq(steps.flatMap((s) => Object.keys(s.metrics)))
        const vals = steps.map((s) => s.metrics[metric] ?? 0)
        const yt = niceTicks(Math.max(...vals, 1e-9))
        const [W, H, m] = [300, 300, 40]
        const y = linearScale([0, yt.at(-1)!], [H - 14, 8])
        const bw = (W - m) / steps.length
        return (
          <>
            <Slicer
              label="Measure"
              cycles={false}
              options={keys}
              value={metric}
              onChange={setMetric}
            />
            <Svg
              w={W}
              h={H}
              label="Symbolic atlas measures across research steps"
            >
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
                    {fmt(t)}
                  </text>
                </g>
              ))}
              {steps.map((s, i) => (
                <g key={s.id}>
                  <rect
                    x={m + i * bw + bw * 0.15}
                    width={bw * 0.7}
                    y={y(vals[i])}
                    height={H - 14 - y(vals[i])}
                    rx={4}
                    fill={color(i + 1)}
                  >
                    <title>{`${s.name}: ${fmt(vals[i])}`}</title>
                  </rect>
                  <text
                    className="mean-txt-t"
                    x={m + (i + 0.5) * bw}
                    y={H - 2}
                    textAnchor="middle"
                  >
                    {s.id}
                  </text>
                </g>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}
function ClusterSkyline() {
  const data = useData<SymSummary>(SYM)
  return (
    <Frame data={data}>
      {({ evaluation }) => {
        const sizes = Object.entries(evaluation.cluster_sizes).sort(
          (a, b) => b[1] - a[1],
        )
        const [W, H, m] = [600, 260, 30]
        const yt = niceTicks(sizes[0]?.[1] ?? 1)
        const y = linearScale([0, yt.at(-1)!], [H - 4, 6])
        const bw = (W - m) / sizes.length
        return (
          <Svg
            w={W}
            h={H}
            label="Size of every symbolic cluster, largest first"
          >
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
            {sizes.map(([id, n], i) => (
              <rect
                key={id}
                x={m + i * bw}
                width={bw * 0.85}
                y={y(n)}
                height={H - 4 - y(n)}
                fill={color(+id)}
              >
                <title>{`${id}: ${n}`}</title>
              </rect>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function ConceptLift() {
  const data = useData<Profile[]>('concepts/profiles.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const corpora = uniq(rows.map((r) => r.corpus_id))
        const concepts = uniq(rows.map((r) => r.concept_id)).sort()
        const v = new Map(
          rows.map((r) => [`${r.concept_id}|${r.corpus_id}`, r.rank1_lift]),
        )
        const [W, H, mx, my] = [300, 600, 90, 14]
        const cw = (W - mx) / corpora.length
        const ch = (H - my) / concepts.length
        return (
          <Svg
            w={W}
            h={H}
            label="How strongly each concept leads in each corpus"
          >
            {corpora.map((c, j) => (
              <text
                key={c}
                className="mean-txt-t"
                x={mx + (j + 0.5) * cw}
                y={10}
                textAnchor="middle"
              >
                {c}
              </text>
            ))}
            {concepts.map((k, i) => (
              <g key={k}>
                <text
                  className="mean-txt-t"
                  x={mx - 4}
                  y={my + (i + 0.5) * ch + 3}
                  textAnchor="end"
                >
                  {k}
                </text>
                {corpora.map((c, j) => {
                  const l = v.get(`${k}|${c}`) ?? 0
                  return (
                    <rect
                      key={c}
                      x={mx + j * cw + 1}
                      y={my + i * ch + 1}
                      width={cw - 2}
                      height={ch - 2}
                      rx={3}
                      fill={
                        l
                          ? mix(color(j), Math.min(100, 12 + 22 * l))
                          : 'var(--wash)'
                      }
                    >
                      <title>{`${k} · ${c}: ${l.toFixed(2)}×`}</title>
                    </rect>
                  )
                })}
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

const d = 'ml'
export const posts: Post[] = [
  { id: 'txt-ml-research-steps', domain: d, render: () => <ResearchSteps /> },
  {
    id: 'txt-ml-cluster-skyline',
    domain: d,
    size: 'wide',
    render: () => <ClusterSkyline />,
  },
  {
    id: 'txt-ml-concept-lift',
    domain: d,
    size: 'tall',
    render: () => <ConceptLift />,
  },
]
