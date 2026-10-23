/** The symbolic atlas corpus: how often each symbol occurs, and words per tradition. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { Bars, fmt, heading, usable } from './txt-kit'

type SymSummary = {
  symbols: { id: string; label: string; points: number; occurrences: number }[]
  documents: { id: string; title: string; tradition: string; words: number }[]
  traditions: string[]
}
const SYM = 'symbolic/summary.json'
const SYM_METRICS = ['occurrences', 'points'] as const
type Metric = (typeof SYM_METRICS)[number]
/** What each measure counts, for the slicer, the caption and the screen reader. */
const METRIC_NAME: Record<Metric, string> = {
  occurrences: 'Occurrences in the corpus',
  points: 'Occurrences placed on the map',
}
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
const bySymbol = (s: SymSummary, k: Metric) =>
  [...s.symbols].sort((a, b) => b[k] - a[k])
const byTradition = ({ documents }: SymSummary) =>
  [
    ...documents.reduce(
      (m, d) => m.set(d.tradition, (m.get(d.tradition) ?? 0) + d.words),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1])

function SymbolBars() {
  const data = usable(useData<SymSummary>(SYM), SYM, (s) => s.symbols.length)
  const [metric, setMetric] = useState<Metric>('occurrences')
  return (
    <Frame data={data}>
      {(s) => (
        <>
          <Slicer
            label="Measure"
            cycles={false}
            options={SYM_METRICS}
            format={(m) => METRIC_NAME[m]}
            value={metric}
            onChange={setMetric}
          />
          <p className="mean-cap">{METRIC_NAME[metric]}</p>
          <Bars
            label={`${METRIC_NAME[metric]} per symbol, most first`}
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
function TraditionBars() {
  const data = usable(useData<SymSummary>(SYM), SYM, (s) => s.documents.length)
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

export const posts: Post[] = [
  {
    id: 'txt-ml-symbol-radial',
    domain: d,
    sources: ['symbolic/summary.json'],
    title: heading((s: SymSummary) => {
      const [x] = bySymbol(s, 'occurrences')
      return `${x.label} is the most frequent of the ${s.symbols.length} symbols, with ${fmt(x.occurrences)} occurrences`
    }),
    note: 'Times each symbol word occurs in the myth and folklore corpus',
    render: () => <SymbolBars />,
  },
  {
    id: 'txt-ml-book-treemap',
    domain: d,
    sources: ['symbolic/summary.json'],
    title: heading((s: SymSummary) => {
      const rows = byTradition(s)
      const [[t, n]] = rows
      return `${tradition(t)} texts are the largest of ${rows.length} traditions, with ${fmt(n)} words`
    }),
    note: 'Words per tradition across the books of the myth and folklore corpus',
    render: () => <TraditionBars />,
  },
]
