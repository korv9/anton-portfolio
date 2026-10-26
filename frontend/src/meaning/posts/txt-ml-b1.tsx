/** The symbolic atlas corpus: how often each symbol occurs, and words per tradition. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { Bars, fmt, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type SymSummary = {
  symbols: { id: string; label: string; points: number; occurrences: number }[]
  documents: { id: string; title: string; tradition: string; words: number }[]
  traditions: string[]
}
const SYM = 'symbolic/summary.json'
const SYM_METRICS = ['occurrences', 'points'] as const
type Metric = (typeof SYM_METRICS)[number]
/** What each measure counts, for the slicer, the caption and the screen reader. */
const METRIC_NAME: Record<Metric, () => string> = {
  occurrences: () => l('Occurrences in the corpus', 'Förekomster i korpusen'),
  points: () =>
    l('Occurrences placed on the map', 'Förekomster placerade på kartan'),
}
/** Swedish names for the symbol words; the file's labels are English. */
const SYMBOL_SV: Record<string, string> = {
  bird: 'Fågel',
  blood: 'Blod',
  child: 'Barn',
  darkness: 'Mörker',
  death: 'Död',
  door: 'Dörr',
  eye: 'Öga',
  fire: 'Eld',
  forest: 'Skog',
  moon: 'Måne',
  mother: 'Moder',
  mountain: 'Berg',
  raven: 'Korp',
  river: 'Flod',
  snake: 'Orm',
  star: 'Stjärna',
  sun: 'Sol',
  tree: 'Träd',
  water: 'Vatten',
  wolf: 'Varg',
}
const symbol = (s: { id: string; label: string }) =>
  l(s.label, SYMBOL_SV[s.id] ?? s.label)
const d = 'ml'

/** Plain names for the corpus's tradition ids. */
const TRADITION: Record<string, [string, string]> = {
  'celtic-arthurian': ['Celtic and Arthurian', 'Keltisk och arturisk'],
  'christian-biblical': ['Christian and biblical', 'Kristen och biblisk'],
  'east-asian': ['East Asian', 'Östasiatisk'],
  'egyptian-near-eastern': [
    'Egyptian and Near Eastern',
    'Egyptisk och främreorientalisk',
  ],
  'european-folklore': ['European folklore', 'Europeisk folktro'],
  'finnish-baltic': ['Finnish and Baltic', 'Finsk och baltisk'],
  'greek-roman': ['Greek and Roman', 'Grekisk och romersk'],
  'indigenous-north-american': [
    'Indigenous North American',
    'Nordamerikanska urfolk',
  ],
  'middle-eastern-persian': [
    'Middle Eastern and Persian',
    'Mellanöstern och Persien',
  ],
  'norse-germanic': ['Norse and Germanic', 'Fornnordisk och germansk'],
  'slavic-eastern-european': [
    'Slavic and Eastern European',
    'Slavisk och östeuropeisk',
  ],
  'south-asian': ['South Asian', 'Sydasiatisk'],
}
const tradition = (id: string) => {
  const t = TRADITION[id]
  return t ? l(t[0], t[1]) : id.replace(/-/g, ' ')
}
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
            label={l('Measure', 'Mått')}
            cycles={false}
            options={SYM_METRICS}
            format={(m) => METRIC_NAME[m]()}
            value={metric}
            onChange={setMetric}
          />
          <p className="mean-cap">{METRIC_NAME[metric]()}</p>
          <Bars
            label={l(
              `${METRIC_NAME[metric]()} per symbol, most first`,
              `${METRIC_NAME[metric]()} per symbol, flest först`,
            )}
            format={fmt}
            rows={bySymbol(s, metric).map((x) => ({
              key: x.id,
              label: symbol(x),
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
          label={l(
            'Words per tradition in the myth and folklore corpus, most first',
            'Ord per tradition i korpusen med myter och folksagor, flest först',
          )}
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
      return l(
        `${x.label} is the most frequent of the ${s.symbols.length} symbols, with ${fmt(x.occurrences)} occurrences`,
        `${symbol(x)} är den vanligaste av de ${s.symbols.length} symbolerna, med ${fmt(x.occurrences)} förekomster`,
      )
    }),
    note: [
      'Times each symbol word occurs in the myth and folklore corpus',
      'Hur många gånger varje symbolord förekommer i korpusen med myter och folksagor',
    ],
    render: () => <SymbolBars />,
  },
  {
    id: 'txt-ml-book-treemap',
    domain: d,
    sources: ['symbolic/summary.json'],
    title: heading((s: SymSummary) => {
      const rows = byTradition(s)
      const [[t, n]] = rows
      return l(
        `${tradition(t)} texts are the largest of ${rows.length} traditions, with ${fmt(n)} words`,
        `${tradition(t)}: störst av ${rows.length} traditioner, med ${fmt(n)} ord`,
      )
    }),
    note: [
      'Words per tradition across the books of the myth and folklore corpus',
      'Ord per tradition i böckerna i korpusen med myter och folksagor',
    ],
    render: () => <TraditionBars />,
  },
]
