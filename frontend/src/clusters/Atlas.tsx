/**
 * The atlas (atlas/*.json): six corpora in one multilingual space, clustered without labels.
 * Coloured by cluster, the map shows themes; coloured by corpus, it shows where a debate, a law,
 * a myth and a philosopher end up side by side. Below it, the links between corpora that clear
 * their interval. Group terms are generated and marked unreviewed.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import ClusterScatter, { type ClusterPoint } from './ClusterScatter'
import './experiments/experiments.css'

type Check = { purity: { overall: number; random: number } }
type Meta = {
  passages: number
  by_corpus: Record<string, number>
  clusters: number
  mixed_clusters: number
  noise_share: number
  checks: Record<'raw' | 'centred' | 'whitened', Check> & {
    whitened: { translation: { top1: number; pairs: number } }
  }
}
type Points = {
  corpora: string[]
  x: number[]
  y: number[]
  corpus: number[]
  cluster: number[]
}
type Example = { corpus: string; label: string; text: string }
type Cluster = {
  id: number
  size: number
  shares: Record<string, number>
  mixed: boolean
  terms: string[]
  examples: Example[]
}
type Link = {
  from: string
  to: string
  lift: number
  low: number
  high: number
}
type Pair = { from: string; to: string; links: Link[] }
type Data = { meta: Meta; points: Points; clusters: Cluster[]; links: Pair[] }

const CORPUS: Record<string, () => string> = {
  debates: () => l('Party-leader debates', 'Partiledardebatter'),
  laws: () => l('Swedish laws', 'Svenska lagar'),
  symbols: () => l('Myth and folklore', 'Myter och folksagor'),
  philosophy: () => l('Philosophy', 'Filosofi'),
  jobs: () => l('Job adverts', 'Platsannonser'),
  ai_act: () => l('EU AI Act', 'EU:s AI-förordning'),
}
const SHOWN_PAIRS: [string, string, () => string][] = [
  ['debates', 'symbols', () => l('Party to myth', 'Parti till myt')],
  [
    'debates',
    'philosophy',
    () => l('Party to philosopher', 'Parti till filosof'),
  ],
  ['debates', 'laws', () => l('Party to law', 'Parti till lag')],
]
const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const dec = (n: number) => l(n.toFixed(2), n.toFixed(2).replace('.', ','))
const pct = (n: number) => `${Math.round(n * 100)} %`
/** One decimal, so 99.5 % is not shown as 100 %. */
const pct1 = (n: number) =>
  `${l((n * 100).toFixed(1), (n * 100).toFixed(1).replace('.', ','))} %`
const corpusName = (key: string) => CORPUS[key]?.() ?? key

export default function Atlas() {
  const [data, setData] = useState<Data | 'error' | null>(null)
  const [view, setView] = useState<'cluster' | 'corpus'>('corpus')
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => {
    Promise.all(
      ['meta', 'points', 'clusters', 'links'].map((f) =>
        fetchJson<unknown>(`atlas/${f}.json`),
      ),
    ).then(
      ([meta, points, clusters, links]) =>
        setData({ meta, points, clusters, links } as Data),
      () => setData('error'),
    )
  }, [])
  const byId = useMemo(
    () =>
      new Map(
        data && data !== 'error' ? data.clusters.map((c) => [c.id, c]) : [],
      ),
    [data],
  )
  const points = useMemo<ClusterPoint[]>(() => {
    if (!data || data === 'error') return []
    const p = data.points
    return p.x.map((x, i) => ({
      x,
      y: -p.y[i],
      c: view === 'corpus' ? p.corpus[i] : p.cluster[i],
      label: corpusName(p.corpora[p.corpus[i]]),
    }))
  }, [data, view])

  if (data === null)
    return (
      <p className="cx-state" role="status" aria-busy="true">
        {l('Loading the atlas…', 'Läser in atlasen…')}
      </p>
    )
  if (data === 'error')
    return (
      <p className="cx-state" role="alert">
        {l('The atlas did not load.', 'Atlasen kunde inte läsas.')}
      </p>
    )
  const { meta } = data
  const name = (c: number) =>
    view === 'corpus'
      ? corpusName(data.points.corpora[c])
      : (byId.get(c)?.terms.slice(0, 3).join(', ') ?? '')
  const chosen = view === 'cluster' && picked != null ? byId.get(picked) : null
  return (
    <section className="cx" id="cv-atlas" aria-labelledby="cv-atlas-title">
      <h2 id="cv-atlas-title">
        {l('One map for six corpora', 'En karta för sex korpusar')}
      </h2>
      <p className="cx-question">
        {l(
          `${num(meta.passages)} passages from debates, laws, myths, philosophy, job adverts and the AI Act, embedded by one multilingual model and clustered without any labels. ${meta.mixed_clusters} of ${meta.clusters} groups mix corpora: a law and a debate about the same matter, a myth beside them.`,
          `${num(meta.passages)} passager ur debatter, lagar, myter, filosofi, platsannonser och AI-förordningen, inbäddade med en flerspråkig modell och klustrade utan etiketter. ${meta.mixed_clusters} av ${meta.clusters} grupper blandar korpusar: en lag och en debatt om samma sak, en myt bredvid.`,
        )}
      </p>
      <p className="cx-note">
        {l(
          `Each corpus is whitened on its own, so a law's register no longer decides where it lands. A passage's nearest neighbours then come from its own corpus ${pct(meta.checks.whitened.purity.overall)} of the time, against ${pct(meta.checks.raw.purity.overall)} before (${pct(meta.checks.whitened.purity.random)} at random). ${pct1(meta.checks.whitened.translation.top1)} of Swedish AI Act paragraphs still find their English original.`,
          `Varje korpus vitas för sig, så att lagspråket inte längre avgör var en lag hamnar. En passages närmaste grannar kommer då från den egna korpusen i ${pct(meta.checks.whitened.purity.overall)} av fallen, mot ${pct(meta.checks.raw.purity.overall)} innan (${pct(meta.checks.whitened.purity.random)} vid slump). ${pct1(meta.checks.whitened.translation.top1)} av AI-förordningens svenska stycken hittar fortfarande sitt engelska original.`,
        )}
      </p>
      <div
        className="cv-variants"
        role="group"
        aria-label={l('Colour', 'Färg')}
      >
        {(['corpus', 'cluster'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => {
              setView(v)
              setPicked(null)
            }}
          >
            {v === 'corpus'
              ? l('By corpus', 'Per korpus')
              : l('By cluster', 'Per kluster')}
          </button>
        ))}
      </div>
      <ClusterScatter
        key={view}
        points={points}
        name={name}
        label={l(
          `Atlas of ${num(meta.passages)} passages, coloured by ${view}`,
          `Atlas med ${num(meta.passages)} passager, färgad per ${view === 'corpus' ? 'korpus' : 'kluster'}`,
        )}
        picked={picked}
        onPick={setPicked}
      />
      {chosen && <Detail cluster={chosen} />}
      {view === 'cluster' && (
        <p className="cx-note">
          {l(
            'Group terms are generated from the passages and have not been reviewed.',
            'Gruppernas ord är genererade ur passagerna och inte granskade.',
          )}
        </p>
      )}
      {SHOWN_PAIRS.map(([from, to, title]) => {
        const pair = data.links.find((p) => p.from === from && p.to === to)
        return pair && pair.links.length ? (
          <Links key={to} title={title()} pair={pair} />
        ) : null
      })}
    </section>
  )
}

function Detail({ cluster }: { cluster: Cluster }) {
  return (
    <div className="cx-detail">
      <h3>{cluster.terms.slice(0, 5).join(', ')}</h3>
      <p className="cx-note">
        {num(cluster.size)} {l('passages', 'passager')}:{' '}
        {Object.entries(cluster.shares)
          .filter(([, s]) => s >= 0.05)
          .map(([k, s]) => `${corpusName(k)} ${pct(s)}`)
          .join(', ')}
      </p>
      <ul className="cx-examples">
        {cluster.examples.map((e) => (
          <li key={`${e.corpus}-${e.label}`}>
            <strong>{corpusName(e.corpus)}</strong> · {e.label}
            {e.text && <q>{e.text}…</q>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Links({ title, pair }: { title: string; pair: Pair }) {
  return (
    <>
      <h3>{title}</h3>
      <div
        className="cx-table-wrap"
        tabIndex={0}
        role="region"
        aria-label={title}
      >
        <table className="cx-table">
          <caption>
            {l(
              "How much more often a party's passages land beside this group than the debates as a whole do. 1 means no difference; 95% interval over resampled debates.",
              'Hur mycket oftare ett partis passager hamnar bredvid gruppen än debatterna i stort. 1 betyder ingen skillnad; 95-procentsintervall över omdragna debatter.',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Party', 'Parti')}</th>
              <th scope="col">{l('Nearest', 'Närmast')}</th>
              <th scope="col">{l('Lift', 'Lyft')}</th>
              <th scope="col">{l('95% interval', '95 % intervall')}</th>
            </tr>
          </thead>
          <tbody>
            {pair.links.map((r) => (
              <tr key={`${r.from}-${r.to}`}>
                <td>{r.from}</td>
                <td>{r.to.replace(/-/g, ' ')}</td>
                <td>{dec(r.lift)}</td>
                <td>
                  {dec(r.low)}–{dec(r.high)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
