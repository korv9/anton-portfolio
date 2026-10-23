/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Bars, Legend, Svg, fmt, palette, uniq } from './txt-kit'

type SymSummary = {
  document_count: number
  occurrence_count: number
  point_count: number
  symbol_count: number
  cluster_count: number
  symbols: { id: string; label: string; points: number; occurrences: number }[]
  documents: { id: string; title: string; tradition: string; words: number }[]
  traditions: string[]
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

/** Plain names for the corpus's tradition ids. */
const TRADITION: Record<string, string> = {
  'celtic-arthurian': 'Celtic and Arthurian',
  'christian-biblical': 'Christian and biblical',
  'east-asian': 'East Asian',
  'egyptian-near-eastern': 'Egyptian and Near Eastern',
  'european-folklore': 'European folklore',
  'finnish-baltic': 'Finnish and Baltic',
  'greek-roman': 'Greek and Roman',
  'indigenous-north-american': 'Indigenous North American',
  'middle-eastern-persian': 'Middle Eastern and Persian',
  'norse-germanic': 'Norse and Germanic',
  'slavic-eastern-european': 'Slavic and Eastern European',
  'south-asian': 'South Asian',
}
const tradition = (id: string) => TRADITION[id] ?? id.replace(/-/g, ' ')
const bySymbol = (s: SymSummary, k: (typeof SYM_METRICS)[number]) =>
  [...s.symbols].sort((a, b) => b[k] - a[k])
const byTradition = ({ documents }: SymSummary) =>
  [
    ...documents.reduce(
      (m, d) => m.set(d.tradition, (m.get(d.tradition) ?? 0) + d.words),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1])

function SymbolRadial() {
  const data = useData<SymSummary>(SYM)
  const [metric, setMetric] =
    useState<(typeof SYM_METRICS)[number]>('occurrences')
  return (
    <Frame data={data}>
      {(s) => (
        <>
          <Slicer
            label="Measure"
            cycles={false}
            options={SYM_METRICS}
            format={(m) => (m === 'points' ? 'Mapped passages' : 'Occurrences')}
            value={metric}
            onChange={setMetric}
          />
          <Bars
            label="Occurrences of each symbol in the corpus, most first"
            format={fmt}
            rows={bySymbol(s, metric).map((x) => ({
              key: x.id,
              label: x.label,
              value: x[metric],
            }))}
          />
        </>
      )}
    </Frame>
  )
}
function BookTreemap() {
  const data = useData<SymSummary>(SYM)
  return (
    <Frame data={data}>
      {(s) => (
        <Bars
          label="Words per tradition in the myth and folklore corpus, most first"
          format={fmt}
          long
          rows={byTradition(s).map(([t, n]) => ({
            key: t,
            label: tradition(t),
            value: n,
          }))}
        />
      )}
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
              cycles={false}
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
  {
    id: 'txt-ml-symbol-radial',
    domain: d,
    sources: ['symbolic/summary.json'],
    title: (s: SymSummary) => {
      const [x] = bySymbol(s, 'occurrences')
      return `${x.label} is the most frequent of the ${s.symbols.length} symbols, with ${fmt(x.occurrences)} occurrences`
    },
    note: 'Times each symbol word occurs in the myth and folklore corpus',
    render: () => <SymbolRadial />,
  },
  {
    id: 'txt-ml-book-treemap',
    domain: d,
    sources: ['symbolic/summary.json'],
    title: (s: SymSummary) => {
      const [[t, n]] = byTradition(s)
      return `${tradition(t)} texts are the largest of ${s.traditions.length} traditions, with ${fmt(n)} words`
    },
    note: 'Words per tradition across the books of the myth and folklore corpus',
    render: () => <BookTreemap />,
  },
  {
    id: 'txt-ml-model-parallel',
    domain: d,
    sources: ['symbolic/model-comparison.json'],
    size: 'wide',
    render: () => <ModelParallel />,
  },
]
