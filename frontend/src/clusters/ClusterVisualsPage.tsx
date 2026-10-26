/**
 * Cluster visuals: the sentence demo on the party-leader debate map, then every clustering
 * dataset as a large map (ClusterGallery), with the method notes folded away at the bottom.
 * MAPS and ProjectMaps keep the interactive maps for the project reports and the UMAP gallery.
 */
import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import {
  loadAtlasPoints,
  loadAtlasSummary,
  loadBookCenteredAtlas,
} from '../symbolic/atlasData'
import ClusterScatter, { type ClusterPoint, unnamed } from './ClusterScatter'
import ClusterLab from './ClusterLab'
import './clusters.css'
import SentencePlacer from './SentencePlacer'
import ClusterGallery from './ClusterGallery'

export type Loaded = {
  points: ClusterPoint[]
  population?: { observations: number; clusters: number; noise_share: number }
  name?: (c: number) => string
  /** The method, as the run that made the map recorded it. */
  method: string[]
}
type Variant = { key: string; label: string; load: () => Promise<Loaded> }
export type MapSpec = {
  id: string
  project: string
  href: string
  title: string
  meaning: string
  variants: Variant[]
}

const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const pct = (share: number) =>
  `${(share * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })} %`
const cut = (text: string, n = 110) =>
  text.length > n ? `${text.slice(0, n).trimEnd()}…` : text
type Umap = {
  n_components: number
  n_neighbors: number
  min_dist: number
  metric: string
}
type Hdbscan = { min_cluster_size: number; min_samples: number }
const umap = (u: Umap) =>
  `UMAP ${u.n_components}D, n_neighbors ${u.n_neighbors}, min_dist ${u.min_dist}, ${u.metric}`
const hdbscan = (h: Hdbscan) =>
  `HDBSCAN min_cluster_size ${h.min_cluster_size}, min_samples ${h.min_samples}`

/** Names each cluster by the most common key among its points, for maps without written names. */
function mostCommon<T>(
  items: T[],
  cluster: (t: T) => number,
  key: (t: T) => string,
) {
  const counts = new Map<number, Map<string, number>>()
  for (const t of items) {
    const c = cluster(t)
    if (c < 0) continue
    const m = counts.get(c) ?? new Map<string, number>()
    m.set(key(t), (m.get(key(t)) ?? 0) + 1)
    counts.set(c, m)
  }
  const names = new Map(
    [...counts].map(([c, m]) => [c, [...m].sort((a, b) => b[1] - a[1])[0][0]]),
  )
  return (c: number) => names.get(c) ?? unnamed()
}

// ---------- Symbol Lab ----------
type SymbolicRun = {
  embedding_model: string
  umap_map: Umap
  umap_cluster_space: Umap
  hdbscan: Hdbscan
}
let symbolicBase: Promise<Awaited<ReturnType<typeof loadAtlasPoints>>> | null =
  null
const symbolicPoints = () => (symbolicBase ??= loadAtlasPoints())
async function symbolicMethod() {
  const summary = (await loadAtlasSummary()) as unknown as { run: SymbolicRun }
  const r = summary.run
  return [
    r.embedding_model.replace('sentence-transformers/', ''),
    umap(r.umap_cluster_space),
    umap(r.umap_map),
    hdbscan(r.hdbscan),
  ]
}
const symbolicLabel = (p: {
  symbol_id: string
  title: string
  context: string
}) => `${p.symbol_id} · ${p.title} · “${cut(p.context, 90)}”`
const symbolBook = (p: { symbol_id: string; title: string }) =>
  `${p.symbol_id} · ${cut(p.title, 40)}`

// ---------- Philosophy Lab ----------
type PhilosophySummary = {
  works: { title: string; author: string }[]
  run: { model: string; umap_map: Umap; hdbscan: Hdbscan }
}
type PhilosophyPoint = [string, number, number, number, number]
let philosophy: Promise<
  [PhilosophySummary, Record<string, PhilosophyPoint[]>]
> | null = null
async function loadPhilosophy(
  variant: 'baseline' | 'author_centered',
): Promise<Loaded> {
  philosophy ??= Promise.all([
    fetchJson<PhilosophySummary>('philosophy/summary.json'),
    fetchJson<Record<string, PhilosophyPoint[]>>('philosophy/atlas.json'),
  ])
  const [summary, atlas] = await philosophy
  const points = atlas[variant].map(([, work, x, y, c]) => ({
    x,
    y,
    c,
    label: `${summary.works[work].author}, ${summary.works[work].title}`,
  }))
  return {
    points,
    name: mostCommon(
      points,
      (p) => p.c,
      (p) => p.label,
    ),
    method: [
      summary.run.model.replace('sentence-transformers/', ''),
      umap(summary.run.umap_map),
      hdbscan(summary.run.hdbscan),
    ],
  }
}

// ---------- Job ads ----------
type JobSummary = {
  shards: string[]
  config: {
    model: string
    neighbors: number
    dimensions: number
    min_cluster_size: number
    min_samples: number
  }
  clusters: { cluster_id: number; cluster_label: string }[]
}
async function loadJobs(): Promise<Loaded> {
  const summary = await fetchJson<JobSummary>('jobs/cluster-summary.json')
  const points: ClusterPoint[] = []
  for (const shard of summary.shards) {
    const part = await fetchJson<{
      points: {
        x: number
        y: number
        cluster: number
        title: string
        year: number
      }[]
    }>(shard)
    for (const p of part.points)
      points.push({
        x: p.x,
        y: p.y,
        c: p.cluster,
        label: `${p.title} (${p.year})`,
      })
  }
  const names = new Map(
    summary.clusters.map((c) => [c.cluster_id, c.cluster_label]),
  )
  const c = summary.config
  return {
    points,
    name: (id) => names.get(id) ?? unnamed(),
    method: [
      c.model.replace('sentence-transformers/', ''),
      `UMAP ${c.dimensions}D, n_neighbors ${c.neighbors}`,
      `HDBSCAN min_cluster_size ${c.min_cluster_size}, min_samples ${c.min_samples}`,
    ],
  }
}

async function loadResearch(slug: string): Promise<Loaded> {
  const data = await fetchJson<{
    observations: number
    clusters: number
    noise_share: number
    /** The method, written by the export from the run's own record. */
    method: string[]
    /** Model-proposed names, English then Swedish; a group without one has no clear theme. */
    names: Record<string, [string, string]>
    points: [string, number, number, number, string][]
  }>(`cluster-research/${slug}.json`)
  return {
    points: data.points.map(([, x, y, c, label]) => ({ x, y, c, label })),
    population: data,
    name: (id) => {
      const named = data.names[id]
      return named ? l(named[0], named[1]) : unnamed()
    },
    method: data.method,
  }
}

// One function, so the lead map's loader keeps its identity across renders.
const debateTopics = () => loadResearch('debate-topics')

export const MAPS = (): MapSpec[] => [
  {
    id: 'research-debates',
    project: l('Riksdag debates', 'Riksdagsdebatter'),
    href: '#what-does-it-even-mean',
    title: l(
      'Party-leader debates by subject',
      'Partiledardebatter efter ämne',
    ),
    meaning: l(
      'Each point is a passage of whole sentences, 80 to 150 words, from 108 party-leader debates 1993–2026. The address to the Speaker, applause notes and endorsement lists were removed before embedding. Grey points belong to no group. A language model read sample passages from each group and proposed its name; the names are the model’s labels, not a person’s reading.',
      'Varje punkt är en passage med hela meningar, 80 till 150 ord, ur 108 partiledardebatter 1993–2026. Tilltalet till talmannen, applådnoteringar och instämmandelistor togs bort före inbäddningen. Grå punkter hör inte till någon grupp. En språkmodell läste exempelpassager ur varje grupp och föreslog dess namn; namnen är modellens etiketter, inte en persons läsning.',
    ),
    variants: [
      {
        key: 'debate-topics',
        label: l('Subjects', 'Ämnen'),
        load: debateTopics,
      },
    ],
  },
  {
    id: 'research-philosophy',
    project: 'Philosophy Lab',
    href: '#philosophy-atlas',
    title: l(
      'Passages from 113 works of philosophy',
      'Passager ur 113 filosofiska verk',
    ),
    meaning: l(
      'Each point is a passage, at most 200 per work, from 113 works by 66 authors on Project Gutenberg. The search penalises groups that follow one author or translator, so a group here runs across works. The group names were proposed by a language model from sample passages.',
      'Varje punkt är en passage, högst 200 per verk, ur 113 verk av 66 författare på Project Gutenberg. Sökningen ger avdrag för grupper som följer en författare eller översättare, så en grupp här spänner över flera verk. Gruppnamnen föreslogs av en språkmodell utifrån exempelpassager.',
    ),
    variants: [
      {
        key: 'philosophy-topics',
        label: l('Subjects', 'Ämnen'),
        load: () => loadResearch('philosophy-topics'),
      },
    ],
  },
  {
    id: 'research-municipalities',
    project: l('How is Sweden doing?', 'Hur mår Sverige?'),
    href: '#what-does-it-even-mean',
    title: l(
      'Municipal profiles: twelve indicators in 2024',
      'Kommunprofiler: tolv indikatorer 2024',
    ),
    meaning: l(
      'Each point is one of 280 municipalities, placed by the first two principal components of twelve indicators. Ten municipalities are left out: seven lack a value for social assistance and three for Riksdag turnout. The groups describe similar profiles; they do not rank wellbeing. Resampled 200 times, the four groups mostly return (mean bootstrap ARI 0.78), but in the weakest 5 % of rounds agreement falls to 0.50, under the preregistered bar of 0.6, so read them as a summary of profiles rather than a finding.',
      'Varje punkt är en av 280 kommuner, placerad efter de två första principalkomponenterna av tolv indikatorer. Tio kommuner är inte med: sju saknar värde för ekonomiskt bistånd och tre för valdeltagande. Grupperna beskriver liknande profiler och rangordnar inte välmående. Vid 200 omdragningar kommer de fyra grupperna oftast tillbaka (bootstrap-ARI i snitt 0,78), men i de svagaste 5 % av omgångarna sjunker överensstämmelsen till 0,50, under den förregistrerade gränsen 0,6, så läs dem som en sammanfattning av profiler och inte som ett fynd.',
    ),
    variants: [
      {
        key: 'municipalities',
        label: 'PCA · K-means',
        load: () => loadResearch('municipalities'),
      },
    ],
  },
  {
    id: 'symbolic',
    project: 'Symbol Lab',
    href: '#symbolic-atlas',
    title: l('Symbol words in their sentences', 'Symbolord i sina meningar'),
    meaning: l(
      'Each point is one use of one of 20 symbol words in 101 books of myth and literature. Close points share language; the book-centred view takes out each book’s own voice.',
      'Varje punkt är en användning av ett av 20 symbolord i 101 böcker med myter och litteratur. Närliggande punkter delar språk; vyn över böcker tar bort varje boks egen röst.',
    ),
    variants: [
      {
        key: 'base',
        label: l('Baseline', 'Utgångsläge'),
        load: async () => {
          const [points, method] = await Promise.all([
            symbolicPoints(),
            symbolicMethod(),
          ])
          return {
            points: points.map((p) => ({
              x: p.x,
              y: p.y,
              c: p.is_noise ? -1 : p.cluster_id,
              label: symbolicLabel(p),
            })),
            name: mostCommon(
              points,
              (p) => (p.is_noise ? -1 : p.cluster_id),
              symbolBook,
            ),
            method,
          }
        },
      },
      {
        key: 'book',
        label: l('Across books', 'Över böcker'),
        load: async () => {
          const [base, book, method] = await Promise.all([
            symbolicPoints(),
            loadBookCenteredAtlas(),
            symbolicMethod(),
          ])
          const byId = new Map(base.map((p) => [p.occurrence_id, p]))
          return {
            name: mostCommon(
              book ?? [],
              (p) => (p.is_noise ? -1 : p.cluster_id),
              (p) => {
                const b = byId.get(p.occurrence_id)
                return b ? symbolBook(b) : unnamed()
              },
            ),
            points: (book ?? []).map((p) => {
              const b = byId.get(p.occurrence_id)
              return {
                x: p.x,
                y: p.y,
                c: p.is_noise ? -1 : p.cluster_id,
                label: b ? symbolicLabel(b) : undefined,
              }
            }),
            method: [...method, l('centred per book', 'centrerad per bok')],
          }
        },
      },
    ],
  },
  {
    id: 'philosophy',
    project: 'Philosophy Lab',
    href: '#philosophy-atlas',
    title: l(
      'Passages from 13 works of philosophy',
      'Passager ur 13 filosofiska verk',
    ),
    meaning: l(
      'Each point is a passage. Raw, passages group by work and translator; centred per work, the groups that remain run across works.',
      'Varje punkt är en passage. Rå grupperar sig passagerna efter verk och översättare; centrerat per verk spänner grupperna som blir kvar över flera verk.',
    ),
    variants: [
      {
        key: 'centred',
        label: l('Centred per work', 'Centrerad per verk'),
        load: () => loadPhilosophy('author_centered'),
      },
      {
        key: 'raw',
        label: l('Raw', 'Rå'),
        load: () => loadPhilosophy('baseline'),
      },
    ],
  },
  {
    id: 'jobs',
    project: l('The job market in job ads', 'Arbetsmarknaden i jobbannonser'),
    href: '#what-does-it-even-mean',
    title: l(
      'IT job ads by how they are written',
      'IT-annonser efter hur de är skrivna',
    ),
    meaning: l(
      'Each point is a job ad from 2022–2025, grouped by its text, not its title; the groups are then compared with the job titles.',
      'Varje punkt är en annons från 2022–2025, grupperad efter texten och inte titeln; grupperna jämförs sedan med jobbtitlarna.',
    ),
    variants: [
      { key: 'all', label: l('All ads', 'Alla annonser'), load: loadJobs },
    ],
  },
]

/** Points, clusters, noise and the run's method, as one line under a map's title. */
export function specLine(shown: Loaded) {
  const clusters = new Set(shown.points.filter((p) => p.c >= 0).map((p) => p.c))
    .size
  const noise =
    shown.points.filter((p) => p.c < 0).length / (shown.points.length || 1)
  return [
    `${num(shown.population?.observations ?? shown.points.length)} ${l('points', 'punkter')}`,
    `${shown.population?.clusters ?? clusters} ${l('clusters', 'kluster')}`,
    `${l('noise', 'brus')} ${pct(shown.population?.noise_share ?? noise)}`,
    ...shown.method,
  ].join(' · ')
}

function MapSection({ spec, own }: { spec: MapSpec; own?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [variant, setVariant] = useState(spec.variants[0].key)
  const [data, setData] = useState<Record<string, Loaded | 'error'>>({})
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true)
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNear(true),
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!near || data[variant]) return
    const v = spec.variants.find((x) => x.key === variant)!
    v.load().then(
      (loaded) => setData((d) => ({ ...d, [variant]: loaded })),
      () => setData((d) => ({ ...d, [variant]: 'error' })),
    )
  }, [near, variant, data, spec])
  const shown = data[variant]
  return (
    <section
      className="cv-section"
      ref={ref}
      aria-labelledby={`cv-${spec.id}-title`}
      id={`cv-${spec.id}`}
    >
      <header className="cv-head">
        {!own && (
          <p className="cv-project">
            <a href={spec.href}>{spec.project}</a>
          </p>
        )}
        <h2 id={`cv-${spec.id}-title`}>{spec.title}</h2>
        <p className="cv-meaning">{spec.meaning}</p>
        {shown && shown !== 'error' && (
          <p className="cv-specs">{specLine(shown)}</p>
        )}
        {spec.variants.length > 1 && (
          <div
            className="cv-variants"
            role="group"
            aria-label={l('View', 'Vy')}
          >
            {spec.variants.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={variant === v.key}
                onClick={() => setVariant(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {shown === 'error' ? (
        <p className="cv-status">
          {l('The data did not load.', 'Datan kunde inte läsas.')}
        </p>
      ) : shown ? (
        <ClusterScatter
          key={variant}
          points={shown.points}
          name={shown.name}
          label={`${spec.project}: ${spec.title}`}
        />
      ) : (
        <p
          className="cv-status"
          role="status"
          aria-busy="true"
          aria-label={l('Loading', 'Laddar')}
        />
      )}
    </section>
  )
}

/** A project's own maps inside its report, without the line naming the project. */
export function ProjectMaps({ ids }: { ids: string[] }) {
  return (
    <div className="cv-report">
      {MAPS()
        .filter((spec) => ids.includes(spec.id))
        .map((spec) => (
          <MapSection key={spec.id} spec={spec} own />
        ))}
    </div>
  )
}

export default function ClusterVisualsPage() {
  const maps = MAPS()
  const debates = maps.find((spec) => spec.id === 'research-debates')!
  // The local lab reads a dev-server export; it is asked for only when the address names it.
  const lab =
    import.meta.env.DEV && /[?&]lab(_|=|&|$)/.test(window.location.hash)
  return (
    <div className="cv">
      <header className="cv-intro">
        <h1>{l('Cluster visuals', 'Klustervisualiseringar')}</h1>
        <p>
          {l(
            'The clearest clusterings on the site, drawn from their data.',
            'De tydligaste klustringarna på sajten, ritade ur sin data.',
          )}
        </p>
      </header>
      <SentencePlacer spec={debates} />
      <ClusterGallery />
      <details className="cv-method">
        <summary>{l('How these maps are made', 'Så görs kartorna')}</summary>
        <p>
          {l(
            'Each map is drawn straight from its published points. Clusters take the site’s warm greys by size, the largest brightest; points in no cluster sit dimmer underneath. The frame comes from the clustered points only, and the few points beyond it are left out rather than pressed onto the edge. Close points are similar in the model’s eyes; distances on a 2-D map are a picture, not a measurement.',
            'Varje karta ritas direkt ur sina publicerade punkter. Klustren får sajtens varma grå toner efter storlek, det största ljusast; punkter utan kluster ligger dovare under. Ramen utgår bara från de klustrade punkterna, och de få punkterna utanför lämnas bort i stället för att tryckas mot kanten. Närliggande punkter liknar varandra enligt modellen; avstånd på en 2D-karta är en bild, inte ett mått.',
          )}
        </p>
        <p>
          {l(
            'Your sentence is embedded with bge-m3 by Cloudflare Workers AI, is not logged or stored, and is placed at the closeness-weighted position of its 15 nearest passages. The placement is an approximation, not a new UMAP run.',
            'Din mening bäddas in med bge-m3 av Cloudflare Workers AI, loggas eller sparas inte och placeras på den närhetsviktade positionen för sina 15 närmaste passager. Placeringen är en approximation, inte en ny UMAP-körning.',
          )}
        </p>
        {maps.map((spec) => (
          <p key={spec.id}>
            <strong>{spec.title}.</strong> {spec.meaning}
          </p>
        ))}
        <p>
          <strong>
            {l('Riksdag debates by session.', 'Riksdagsdebatter per riksmöte.')}
          </strong>{' '}
          {l(
            'Up to 400 speech passages from each of the 33 sessions 1993/94–2025/26, placed by one shared topic model so the sessions compare like with like. It is an earlier, unvalidated model: most passages fit none of its topics, so read these maps as texture, not findings. The four earlier sessions come from an older topic model; only its twelve largest groups are drawn.',
            'Upp till 400 talpassager ur vart och ett av de 33 riksmötena 1993/94–2025/26, placerade av en och samma ämnesmodell så att riksmötena går att jämföra. Det är en tidigare, ovaliderad modell: de flesta passager passar inget av dess ämnen, så läs kartorna som textur, inte som resultat. De fyra tidigare riksmötena kommer från en äldre ämnesmodell; bara dess tolv största grupper ritas.',
          )}
        </p>
        <p>
          <strong>
            {l(
              'Cancer drugs by synergy profile.',
              'Cancerläkemedel efter synergiprofil.',
            )}
          </strong>{' '}
          {l(
            'Each point is a drug with at least 300 measured combinations in DrugCombDB, placed by its mean synergy per tissue and grouped by k-means, with k chosen by silhouette.',
            'Varje punkt är ett läkemedel med minst 300 uppmätta kombinationer i DrugCombDB, placerat efter sin genomsnittliga synergi per vävnad och grupperat med k-means, där k valdes efter silhouette.',
          )}
        </p>
      </details>
      {lab && <ClusterLab />}
    </div>
  )
}
