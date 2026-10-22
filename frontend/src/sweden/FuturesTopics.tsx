/**
 * E — The Lost Futures, Explore: the topic pilot from sweden/futures/topics.json
 * (platform/publish/sweden/export_futures_topics.py). Future-marked sentences from Riksdag speeches
 * and DiVA abstracts, clustered in one embedding space without a word list. No cluster is named
 * until the owner has reviewed it, so each is shown as "unreviewed cluster N" with its top terms.
 */
import { useEffect, useState } from 'react'
import MultiLineChart from '../charts/MultiLineChart'
import { fetchJson } from '../dataSource'
import { l } from '../i18n'
import { BASE, num, pct } from './FuturesExplore'

type Corpus = 'riksdag' | 'diva'
type Side = {
  sentences: number
  share_mean: number
  trend_per_decade: number
  trend_p_holm: number | null
}
type Cluster = {
  cluster: number
  label: string
  top_terms: string[]
  stable: boolean
  sentences: number
  riksdag_vs_diva: {
    r_lag0: number
    p_lag0_holm: number
    best_lag: number
    r_best_lag: number
    p_best_lag_holm: number
  } | null
} & Record<Corpus, Side>
type Topics = {
  method: {
    sentences: number
    selected: { clusters: number; coverage: number }
    stability: { seed_ari_mean: number; subsample_ari_mean: number }
    preregistration: string
  }
  clusters: Cluster[]
  columns: string[]
  rows: [number, Corpus, number, number, number, number, number, number][]
}

const CORPORA: Corpus[] = ['riksdag', 'diva']
const corpusName = (c: Corpus) =>
  c === 'riksdag' ? 'Riksdag' : l('DiVA theses', 'DiVA-uppsatser')
const ALPHA = 0.05
const label = (c: Cluster) =>
  l(`Unreviewed cluster ${c.cluster}`, `Ogranskat kluster ${c.cluster}`)
const signed = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`

function Trend({ side }: { side: Side }) {
  const marked = side.trend_p_holm != null && side.trend_p_holm < ALPHA
  return (
    <td className="sw-n">
      {pct(side.share_mean)}{' '}
      <span className="sw-note">
        ({signed(side.trend_per_decade)}
        {marked ? '*' : ''})
      </span>
    </td>
  )
}

export default function FuturesTopics() {
  const [topics, setTopics] = useState<Topics | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => {
    fetchJson<Topics>(BASE + 'topics.json').then(setTopics, () => {})
  }, [])
  if (!topics) return null
  const stable = topics.clusters.filter((c) => c.stable)
  const shown = stable.length ? stable : topics.clusters
  const current = shown.find((c) => c.cluster === picked) ?? shown[0]
  const series = CORPORA.map((corpus) => ({
    key: corpus,
    name: corpusName(corpus),
    points: topics.rows
      .filter((r) => r[1] === corpus && r[2] === current.cluster)
      .map((r) => ({
        date: `${r[0]}-01-01`,
        label: String(r[0]),
        value: r[5] * 100,
      })),
  }))
  const m = topics.method
  return (
    <section aria-labelledby="futures-topics">
      <h3 id="futures-topics">
        {l(
          'Which futures: topics found without a word list (pilot)',
          'Vilka framtider: ämnen funna utan ordlista (pilot)',
        )}
      </h3>
      <p className="sw-note">
        {l(
          `${num(m.sentences)} sentences that use the future marker, at most one per speech or abstract and 1,500 a year per corpus, embedded with a multilingual sentence model and clustered together. ${m.selected.clusters.toFixed(0)} clusters cover ${pct(m.selected.coverage)} of the sentences; refits agree with an adjusted Rand index of ${m.stability.seed_ari_mean.toFixed(2)} across seeds and ${m.stability.subsample_ari_mean.toFixed(2)} across subsamples. ${stable.length} clusters are stable. The clusters are not yet reviewed or named; the terms are what sets each apart.`,
          `${num(m.sentences)} meningar med framtidsmarkören, högst en per anförande eller sammanfattning och 1 500 per år och korpus, inbäddade med en flerspråkig meningsmodell och klustrade tillsammans. ${m.selected.clusters.toFixed(0)} kluster täcker ${pct(m.selected.coverage)} av meningarna; omkörningar stämmer överens med justerat Rand-index ${m.stability.seed_ari_mean.toFixed(2)} mellan seeds och ${m.stability.subsample_ari_mean.toFixed(2)} mellan delurval. ${stable.length} kluster är stabila. Klustren är ännu inte granskade eller namngivna; orden är det som skiljer dem åt.`,
        )}
      </p>
      <div className="sw-controls">
        <label>
          {l('Cluster', 'Kluster')}
          <select
            value={current.cluster}
            onChange={(e) => setPicked(Number(e.target.value))}
          >
            {shown.map((c) => (
              <option key={c.cluster} value={c.cluster}>
                {label(c)}: {c.top_terms.slice(0, 3).join(', ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MultiLineChart
        series={series}
        label={l(
          `${label(current)}: share of sampled sentences per year`,
          `${label(current)}: andel av urvalets meningar per år`,
        )}
        format={(v) => `${v.toFixed(1)} %`}
        colorOf={(k) => CORPORA.indexOf(k as Corpus) + 1}
        yFrom={0}
      />
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l(
              'Mean share per corpus, with the linear trend in percentage points per decade (* Holm-adjusted p < 0.05), and the correlation of yearly changes between the corpora, 2005–2025',
              'Medelandel per korpus, med linjär trend i procentenheter per decennium (* Holm-justerat p < 0,05), och korrelationen mellan korpusarnas årliga förändringar, 2005–2025',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Cluster', 'Kluster')}</th>
              <th scope="col">{l('Top terms', 'Utmärkande ord')}</th>
              {CORPORA.map((c) => (
                <th key={c} scope="col" className="sw-n">
                  {corpusName(c)}
                </th>
              ))}
              <th scope="col" className="sw-n">
                {l('Riksdag–DiVA r', 'Riksdag–DiVA r')}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr
                key={c.cluster}
                aria-current={c.cluster === current.cluster || undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    className="sw-link"
                    onClick={() => setPicked(c.cluster)}
                  >
                    {label(c)}
                  </button>
                </th>
                <td>{c.top_terms.slice(0, 6).join(', ')}</td>
                {CORPORA.map((k) => (
                  <Trend key={k} side={c[k]} />
                ))}
                <td className="sw-n">
                  {c.riksdag_vs_diva
                    ? `${c.riksdag_vs_diva.r_lag0.toFixed(2)}${c.riksdag_vs_diva.p_lag0_holm < ALPHA ? '*' : ''}`
                    : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sw-note">
        {l(
          `Exploratory until the clusters are reviewed. Shares count noise in the denominator. The method, null models and decision rule were fixed in advance (${m.preregistration}).`,
          `Utforskande tills klustren är granskade. Andelarna räknar brus i nämnaren. Metod, nollmodeller och beslutsregel bestämdes i förväg (${m.preregistration}).`,
        )}
      </p>
    </section>
  )
}
