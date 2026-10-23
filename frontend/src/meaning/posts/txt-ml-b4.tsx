/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { useState } from 'react'
import { Frame, Slicer, color, tile, useData, type Post } from '../kit'
import { Legend, Svg, arc, fmt, pct } from './txt-kit'

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
type Eval = {
  compared: {
    model: string
    setting: string
    verified_share: number
    recall_at_k: number
    neurons_per_answer: number
    tokens_in: number
    tokens_out: number
  }[]
}
const SYM = 'symbolic/summary.json'
const short = (m: string) => m.split('/').at(-1)!
const d = 'ml'

function Gauges() {
  const data = useData<Eval>('workers-ai/eval.json')
  const [pick, setPick] = useState(0)
  return (
    <Frame data={data}>
      {({ compared }) => {
        const labels = compared.map((c) => `${short(c.model)} ${c.setting}`)
        const c = compared[pick] ?? compared[0]
        const g = (v: number, cx: number, i: number) => (
          <g key={i}>
            <path
              d={arc(cx, 130, 60, 90, -Math.PI / 2, Math.PI / 2)}
              fill="var(--wash)"
            />
            <path
              d={arc(cx, 130, 60, 90, -Math.PI / 2, -Math.PI / 2 + Math.PI * v)}
              fill={color(i)}
            />
            <text
              x={cx}
              y={126}
              textAnchor="middle"
              fontSize={26}
              fontWeight={600}
              fill="var(--ink)"
            >
              {pct(v)}
            </text>
          </g>
        )
        return (
          <>
            <Slicer
              label="Model"
              options={labels}
              value={labels[pick]}
              onChange={(l) => setPick(labels.indexOf(l))}
            />
            <Svg
              w={400}
              h={150}
              label="Verified answers and retrieval recall for the selected model"
            >
              {g(c.verified_share, 100, 0)}
              {g(c.recall_at_k, 300, 1)}
            </Svg>
            <Legend
              items={[
                ['verified', color(0)],
                ['recall@k', color(1)],
              ]}
            />
            <div className="mean-txt-kpis">
              {(['neurons_per_answer', 'tokens_in', 'tokens_out'] as const).map(
                (k, i) => (
                  <div key={k} style={tile(color(i + 2))}>
                    {fmt(c[k])}
                    <small>{k.replace(/_/g, ' ')}</small>
                  </div>
                ),
              )}
            </div>
          </>
        )
      }}
    </Frame>
  )
}
function SymbolCounts() {
  const data = useData<SymSummary>(SYM)
  return (
    <Frame data={data}>
      {(d) => (
        <div className="mean-txt-kpis">
          {(
            [
              'occurrence_count',
              'point_count',
              'cluster_count',
              'document_count',
              'symbol_count',
            ] as const
          ).map((k, i) => (
            <div key={k} style={tile(color(i))}>
              {fmt(d[k])}
              <small>{k.replace('_count', 's')}</small>
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-gauges',
    domain: d,
    sources: ['workers-ai/eval.json'],
    render: () => <Gauges />,
  },
  {
    id: 'txt-ml-symbol-counts',
    domain: d,
    sources: ['symbolic/summary.json'],
    render: () => <SymbolCounts />,
  },
]
