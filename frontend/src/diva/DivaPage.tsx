/**
 * Swedish student theses in topic clusters, from DiVA. One map of a sample of theses coloured by
 * cluster, each cluster named by its own words; method and the clusters' details at the sides.
 * The data is diva/clusters.json, written by platform/publish/diva_clusters.py after the harvest
 * (platform/ingest/diva/harvest.py, run by the "Harvest DiVA theses" workflow). Until a harvest
 * has run, the page says so and how the data is made.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fixed } from '../format'
import { fetchData } from '../dataSource'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import '../products/mlviz.css'

type Cluster = {
  id: number
  size: number
  words: string[]
  years: { year: number; n: number }[]
  universities: { name: string; n: number }[]
  examples: string[]
}
type Clusters = {
  k: number
  silhouette: Record<string, number>
  theses: number
  vocabulary: number
  explained_variance: number
  years: number[]
  clusters: Cluster[]
  points: { x: number; y: number; c: number; t: string }[]
}

const W = 1000
const H = 640
const PAD = 60
const HUES = [
  '#f3d9a4',
  '#a9cbe8',
  '#e8b4b8',
  '#b8d8b0',
  '#d0c3ec',
  '#f0c7a0',
  '#9fd6cf',
  '#e6d58f',
  '#c9b3a0',
  '#b7c4e6',
  '#e3a9c9',
  '#a8d39b',
]

const num = fixed

function ThesisMap({ data }: { data: Clusters }) {
  const [focus, setFocus] = useState<number | null>(null)
  const placed = useMemo(() => {
    const xs = data.points.map((p) => p.x)
    const ys = data.points.map((p) => p.y)
    const [x0, x1, y0, y1] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ]
    return data.points.map((p) => ({
      ...p,
      px: PAD + ((p.x - x0) / (x1 - x0 || 1)) * (W - 2 * PAD),
      py: H - PAD - ((p.y - y0) / (y1 - y0 || 1)) * (H - 2 * PAD),
    }))
  }, [data])
  const centres = data.clusters.map((c) => {
    const m = placed.filter((p) => p.c === c.id)
    return {
      ...c,
      cx: m.reduce((s, p) => s + p.px, 0) / (m.length || 1),
      cy: m.reduce((s, p) => s + p.py, 0) / (m.length || 1),
    }
  })
  const active = data.clusters.find((c) => c.id === focus) ?? null
  return (
    <div className="dsky">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={l(
          `${num(data.theses)} theses in ${data.k} topic clusters; ${placed.length} shown.`,
          `${num(data.theses)} uppsatser i ${data.k} ämneskluster; ${placed.length} visas.`,
        )}
      >
        <rect width={W} height={H} className="dsky-ground" />
        {placed.map((p, i) => (
          <circle
            key={i}
            cx={p.px}
            cy={p.py}
            r={1.6}
            fill={HUES[p.c % HUES.length]}
            opacity={focus === null || focus === p.c ? 0.75 : 0.08}
          />
        ))}
        {centres.map((c) => (
          <g
            key={c.id}
            className="diva-label"
            onMouseEnter={() => setFocus(c.id)}
            onMouseLeave={() => setFocus(null)}
            opacity={focus === null || focus === c.id ? 1 : 0.25}
          >
            <circle cx={c.cx} cy={c.cy} r={22} fill="transparent" />
            <text
              x={c.cx}
              y={c.cy}
              textAnchor="middle"
              fill={HUES[c.id % HUES.length]}
            >
              {c.words.slice(0, 2).join(', ')}
            </text>
          </g>
        ))}
      </svg>
      <p className="dtree-caption" aria-live="polite">
        {active
          ? `${active.words.join(', ')}: ${num(active.size)} ${l('theses', 'uppsatser')}. ${l('E.g.', 'T.ex.')} “${active.examples[0]}”`
          : l(
              'Each point is a thesis; colour is its cluster, placed by its first two text components. Point at a cluster’s words.',
              'Varje punkt är en uppsats; färgen är dess kluster, placerad efter de två första textkomponenterna. Peka på ett klusters ord.',
            )}
      </p>
    </div>
  )
}

export default function DivaPage() {
  const [data, setData] = useState<Clusters | null | undefined>(undefined)
  useEffect(() => {
    fetchData('diva/clusters.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const method = (
    <>
      <StageBlock title={l('Source', 'Källa')}>
        <p>
          {l(
            'DiVA, the Swedish universities’ publication archive, harvested over OAI-PMH (Dublin Core); records whose type says student thesis.',
            'DiVA, lärosätenas publiceringsarkiv, hämtat via OAI-PMH (Dublin Core); poster vars typ säger studentuppsats.',
          )}
        </p>
      </StageBlock>
      <StageBlock title={l('Method', 'Metod')}>
        <ol className="stage-steps">
          <li>
            {l(
              'Title twice, abstract, keywords',
              'Titel två gånger, sammanfattning, nyckelord',
            )}
          </li>
          <li>
            {l('TF-IDF on words and word pairs', 'TF-IDF på ord och ordpar')}
          </li>
          <li>
            {l(
              'Truncated SVD to 100 dimensions',
              'Trunkerad SVD till 100 dimensioner',
            )}
          </li>
          <li>{l('k-means, k by silhouette', 'k-means, k efter silhuett')}</li>
          <li>
            {l(
              'Words per cluster by class-based TF-IDF',
              'Ord per kluster med klassbaserad TF-IDF',
            )}
          </li>
        </ol>
      </StageBlock>
    </>
  )

  if (data === undefined)
    return <p className="theme-loading">{l('Loading…', 'Laddar…')}</p>

  return (
    <div className="project-page diva-page" id="diva">
      {data ? (
        <Stage
          id="diva-map"
          level={1}
          kicker={l('DiVA, topic clustering', 'DiVA, ämnesklustring')}
          title={l(
            'What Swedish students write about',
            'Vad svenska studenter skriver om',
          )}
          lead={l(
            `${num(data.theses)} student theses, ${data.years[0]}–${data.years.at(-1)}, in ${data.k} topic clusters found from their own words.`,
            `${num(data.theses)} studentuppsatser, ${data.years[0]}–${data.years.at(-1)}, i ${data.k} ämneskluster hittade ur deras egna ord.`,
          )}
          figure={<ThesisMap data={data} />}
          left={
            <>
              {method}
              <StageBlock title={l('Model', 'Modell')}>
                <StageFacts
                  rows={[
                    [l('Theses', 'Uppsatser'), num(data.theses)],
                    [l('Vocabulary', 'Ordförråd'), num(data.vocabulary)],
                    [
                      l('Variance kept', 'Bevarad varians'),
                      `${num(data.explained_variance * 100, 0)} %`,
                    ],
                    [l('Clusters (k)', 'Kluster (k)'), String(data.k)],
                  ]}
                />
              </StageBlock>
            </>
          }
          right={
            <StageBlock title={l('The clusters', 'Klustren')}>
              {data.clusters.slice(0, 10).map((c) => (
                <p key={c.id}>
                  <b>{c.words.slice(0, 4).join(', ')}</b>
                  <br />
                  {num(c.size)} {l('theses', 'uppsatser')}
                  {c.universities[0] && `, ${c.universities[0].name}`}
                </p>
              ))}
            </StageBlock>
          }
        />
      ) : (
        <Stage
          id="diva-map"
          level={1}
          kicker={l('DiVA, topic clustering', 'DiVA, ämnesklustring')}
          title={l(
            'What Swedish students write about',
            'Vad svenska studenter skriver om',
          )}
          lead={l(
            'The harvest has not run yet, so there are no clusters to show. The pipeline is ready: run the “Harvest DiVA theses” workflow and this page fills in.',
            'Hämtningen har inte körts än, så det finns inga kluster att visa. Pipelinen är klar: kör arbetsflödet ”Harvest DiVA theses” så fylls sidan i.',
          )}
          figure={<div className="diva-empty" aria-hidden="true" />}
          left={method}
          right={
            <StageBlock title={l('Tools', 'Verktyg')}>
              <StageTools
                items={[
                  'Python',
                  'OAI-PMH',
                  'scikit-learn',
                  'TF-IDF',
                  'SVD',
                  'k-means',
                  'GitHub Actions',
                ]}
              />
            </StageBlock>
          }
        />
      )}
    </div>
  )
}
