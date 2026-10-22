/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Legend, Svg, arc, fmt, palette, squarify, uniq } from './txt-kit'

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
type ModelRow = Record<string, number> & { model: string; experiment: string }
const SYM = 'symbolic/summary.json'
const short = (m: string) => m.split('/').at(-1)!
const SYM_METRICS = ['occurrences', 'points'] as const
const AXES = [
  'clusters',
  'noise_share',
  'trustworthiness',
  'silhouette',
  'median_membership',
  'mean_largest_book_share',
  'cross_book_occurrence_share',
  'embedding_seconds',
]
const EXPS = ['all', 'baseline', 'book_centered'] as const
const d = 'ml'

function SymbolRadial() {
  const data = useData<SymSummary>(SYM)
  const [metric, setMetric] =
    useState<(typeof SYM_METRICS)[number]>('occurrences')
  return (
    <Frame data={data}>
      {({ symbols }) => {
        const rows = [...symbols].sort((a, b) => b[metric] - a[metric])
        const r = linearScale(
          [0, Math.max(...rows.map((s) => s[metric]))],
          [50, 150],
        )
        const step = (2 * Math.PI) / rows.length
        return (
          <>
            <Slicer
              label="Measure"
              options={SYM_METRICS}
              value={metric}
              onChange={setMetric}
            />
            <Svg
              w={400}
              h={400}
              label="Symbols in myth and folklore as radial bars"
            >
              {rows.map((s, i) => {
                const a = i * step + step / 2
                const [tx, ty] = [
                  200 + (r(s[metric]) + 6) * Math.sin(a),
                  200 - (r(s[metric]) + 6) * Math.cos(a),
                ]
                return (
                  <g key={s.id}>
                    <path
                      d={arc(
                        200,
                        200,
                        46,
                        r(s[metric]),
                        i * step + 0.02,
                        (i + 1) * step - 0.02,
                      )}
                      fill={color(i)}
                    >
                      <title>{`${s.label}: ${fmt(s[metric])}`}</title>
                    </path>
                    <text
                      className="mean-txt-t"
                      x={tx}
                      y={ty + 3}
                      textAnchor={a > Math.PI ? 'end' : 'start'}
                    >
                      {s.label}
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
function BookTreemap() {
  const data = useData<SymSummary>(SYM)
  return (
    <Frame data={data}>
      {({ documents }) => {
        const trad = palette(uniq(documents.map((d) => d.tradition)).sort())
        return (
          <>
            <Svg
              w={300}
              h={600}
              label="Every book in the symbolic atlas sized by words"
            >
              {squarify(documents, (d) => d.words, {
                x: 0,
                y: 0,
                w: 300,
                h: 600,
              }).map((c) => (
                <rect
                  key={c.t.id}
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={trad.get(c.t.tradition)}
                  stroke="var(--paper)"
                  className="mean-txt-hover"
                >
                  <title>{`${c.t.title}: ${fmt(c.t.words)}`}</title>
                </rect>
              ))}
            </Svg>
            <Legend items={[...trad]} />
          </>
        )
      }}
    </Frame>
  )
}
function ModelParallel() {
  const data = useData<{ rows: ModelRow[] }>('symbolic/model-comparison.json')
  const [exp, setExp] = useState<(typeof EXPS)[number]>('all')
  return (
    <Frame data={data}>
      {({ rows }) => {
        const models = palette(uniq(rows.map((r) => short(r.model))))
        const [W, H] = [600, 280]
        const x = (j: number) => 30 + (j * (W - 60)) / (AXES.length - 1)
        const ys = AXES.map((k) => {
          const v = rows.map((r) => r[k])
          return {
            k,
            lo: Math.min(...v),
            hi: Math.max(...v),
            y: linearScale([Math.min(...v), Math.max(...v)], [H - 18, 20]),
          }
        })
        return (
          <>
            <Slicer
              label="Experiment"
              options={EXPS}
              value={exp}
              onChange={setExp}
            />
            <Svg
              w={W}
              h={H}
              label="Embedding models compared on eight clustering measures"
            >
              {ys.map((a, j) => (
                <g key={a.k}>
                  <line
                    x1={x(j)}
                    x2={x(j)}
                    y1={20}
                    y2={H - 18}
                    stroke="var(--line-strong)"
                  />
                  <text
                    className="mean-txt-t"
                    x={x(j)}
                    y={10}
                    textAnchor="middle"
                  >
                    {a.k
                      .replace(/_/g, ' ')
                      .replace('mean largest ', '')
                      .replace('occurrence ', '')}
                  </text>
                  <text className="mean-txt-t" x={x(j) + 3} y={24}>
                    {fmt(a.hi)}
                  </text>
                  <text className="mean-txt-t" x={x(j) + 3} y={H - 8}>
                    {fmt(a.lo)}
                  </text>
                </g>
              ))}
              {rows
                .filter((r) => exp === 'all' || r.experiment === exp)
                .map((r) => (
                  <polyline
                    key={r.model + r.experiment}
                    points={ys
                      .map((a, j) => `${x(j)},${a.y(r[a.k])}`)
                      .join(' ')}
                    fill="none"
                    stroke={models.get(short(r.model))}
                    strokeWidth={2.2}
                    strokeDasharray={
                      r.experiment === 'baseline' ? undefined : '5 3'
                    }
                  >
                    <title>{`${short(r.model)} · ${r.experiment}`}</title>
                  </polyline>
                ))}
            </Svg>
            <Legend items={[...models]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'txt-ml-symbol-radial', domain: d, render: () => <SymbolRadial /> },
  {
    id: 'txt-ml-book-treemap',
    domain: d,
    size: 'tall',
    render: () => <BookTreemap />,
  },
  {
    id: 'txt-ml-model-parallel',
    domain: d,
    size: 'wide',
    render: () => <ModelParallel />,
  },
]
