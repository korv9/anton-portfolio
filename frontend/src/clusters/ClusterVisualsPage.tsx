/**
 * Cluster visuals: every clustering on the site on one page, each drawn from its own data and
 * interactive (ClusterScatter): the UMAP maps of the Symbol Lab, the Philosophy Lab, the job
 * ads and the Riksdag debates. A map loads when it comes near the screen.
 */
import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import {
  loadAtlasPoints,
  loadAtlasSummary,
  loadBookCenteredAtlas,
} from '../symbolic/atlasData'
import ClusterScatter, { type ClusterPoint } from './ClusterScatter'
import ClusterLab from './ClusterLab'
import './clusters.css'
import { loadDebateMap } from './debateData'

type Loaded = {
  points: ClusterPoint[]
  population?: { observations: number; clusters: number; noise_share: number }
  name?: (c: number) => string
  /** The method, as the run that made the map recorded it. */
  method: string[]
}
type Variant = { key: string; label: string; load: () => Promise<Loaded> }
type MapSpec = {
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
  return {
    points: atlas[variant].map(([, work, x, y, c]) => ({
      x,
      y,
      c,
      label: `${summary.works[work].author}, ${summary.works[work].title}`,
    })),
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
    name: (id) => names.get(id) ?? String(id),
    method: [
      c.model.replace('sentence-transformers/', ''),
      `UMAP ${c.dimensions}D, n_neighbors ${c.neighbors}`,
      `HDBSCAN min_cluster_size ${c.min_cluster_size}, min_samples ${c.min_samples}`,
    ],
  }
}

// ---------- Riksdag debates ----------
async function loadDebates(): Promise<Loaded> {
  const [map, overview] = await Promise.all([
    loadDebateMap(),
    fetchJson<{ parliament: { topic_method: string; umap_note: string } }>(
      'politics/overview.json',
    ),
  ])
  return {
    points: map.points,
    name: (id) => map.names.get(id) ?? String(id),
    method: [overview.parliament.topic_method, overview.parliament.umap_note],
  }
}

async function loadResearch(slug: string): Promise<Loaded> {
  const data = await fetchJson<{
    observations: number
    clusters: number
    noise_share: number
    /** The method, written by the export from the run's own record. */
    method: string[]
    /** Reviewed names, English then Swedish; a group without one keeps its number. */
    names: Record<string, [string, string]>
    points: [string, number, number, number, string][]
  }>(`cluster-research/${slug}.json`)
  return {
    points: data.points.map(([, x, y, c, label]) => ({ x, y, c, label })),
    population: data,
    name: (id) => {
      const named = data.names[id]
      return named ? l(named[0], named[1]) : String(id)
    },
    method: data.method,
  }
}

const MAPS = (): MapSpec[] => [
  {
    id: 'research-debates',
    project: 'Political Observatory',
    href: '#politik-tal',
    title: l(
      'Party-leader debates by subject',
      'Partiledardebatter efter ämne',
    ),
    meaning: l(
      'Each point is a passage of whole sentences, 80 to 150 words, from 108 party-leader debates 1993–2026. The address to the Speaker, applause notes and endorsement lists were removed before embedding. Grey points belong to no group. A group has a name only after its passages were read.',
      'Varje punkt är en passage med hela meningar, 80 till 150 ord, ur 108 partiledardebatter 1993–2026. Tilltalet till talmannen, applådnoteringar och instämmandelistor togs bort före inbäddningen. Grå punkter hör inte till någon grupp. En grupp har namn först när dess passager har lästs.',
    ),
    variants: [
      {
        key: 'debate-topics',
        label: l('Subjects', 'Ämnen'),
        load: () => loadResearch('debate-topics'),
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
      'Each point is a passage, at most 200 per work, from 113 works by 66 authors on Project Gutenberg. The search penalises groups that follow one author or translator, so a group here runs across works.',
      'Varje punkt är en passage, högst 200 per verk, ur 113 verk av 66 författare på Project Gutenberg. Sökningen ger avdrag för grupper som följer en författare eller översättare, så en grupp här spänner över flera verk.',
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
    href: '#sweden',
    title: l(
      'Municipal profiles: seven indicators in 2024',
      'Kommunprofiler: sju indikatorer 2024',
    ),
    meaning: l(
      'Each point is one of 280 municipalities, placed by the first two principal components of seven indicators. Ten municipalities lack a value for social assistance and are left out. The groups describe similar profiles; they do not rank wellbeing.',
      'Varje punkt är en av 280 kommuner, placerad efter de två första principalkomponenterna av sju indikatorer. Tio kommuner saknar värde för ekonomiskt bistånd och är inte med. Grupperna beskriver liknande profiler och rangordnar inte välmående.',
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
    href: '#jobb-kluster',
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
  {
    id: 'debates',
    project: l('Political Observatory', 'Political Observatory'),
    href: '#politik-tal',
    title: l(
      'What the Riksdag debates are about',
      'Vad riksdagsdebatterna handlar om',
    ),
    meaning: l(
      'Each point is a text segment from a debate, at most 400 per session over 33 sessions; the colour is the topic the model found.',
      'Varje punkt är ett textsegment ur en debatt, högst 400 per riksmöte under 33 riksmöten; färgen är ämnet modellen hittade.',
    ),
    variants: [
      {
        key: 'all',
        label: l('All sessions', 'Alla riksmöten'),
        load: loadDebates,
      },
    ],
  },
]

function MapSection({ spec }: { spec: MapSpec }) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [variant, setVariant] = useState(spec.variants[0].key)
  const [data, setData] = useState<Record<string, Loaded | 'error'>>({})
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true)
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNear(true),
      { rootMargin: '800px 0px' },
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
  const stats =
    shown && shown !== 'error'
      ? (() => {
          const clusters = new Set(
            shown.points.filter((p) => p.c >= 0).map((p) => p.c),
          ).size
          const noise =
            shown.points.filter((p) => p.c < 0).length /
            (shown.points.length || 1)
          return [
            `${num(shown.population?.observations ?? shown.points.length)} ${l('points', 'punkter')}`,
            `${shown.population?.clusters ?? clusters} ${l('clusters', 'kluster')}`,
            `${l('noise', 'brus')} ${pct(shown.population?.noise_share ?? noise)}`,
          ]
        })()
      : []
  return (
    <section
      className="cv-section"
      ref={ref}
      aria-labelledby={`cv-${spec.id}-title`}
      id={`cv-${spec.id}`}
    >
      <header className="cv-head">
        <p className="cv-project">
          <a href={spec.href}>{spec.project}</a>
        </p>
        <h2 id={`cv-${spec.id}-title`}>{spec.title}</h2>
        <p className="cv-meaning">{spec.meaning}</p>
        {shown && shown !== 'error' && (
          <p className="cv-specs">{[...stats, ...shown.method].join(' · ')}</p>
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
        <p className="cv-status" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </section>
  )
}

export default function ClusterVisualsPage() {
  return (
    <div className="cv">
      <header className="cv-intro">
        <h1>{l('Cluster visuals', 'Klustervisualiseringar')}</h1>
        <p>
          {l(
            'Every clustering on the site, drawn from its data. Point at a dot to read it; click it, or a cluster in the list, to pick out its cluster.',
            'Alla klustringar på sajten, ritade ur sin data. Peka på en prick för att läsa den; klicka på den, eller på ett kluster i listan, för att lyfta fram klustret.',
          )}
        </p>
      </header>
      {MAPS().map((spec) => (
        <MapSection key={spec.id} spec={spec} />
      ))}
      {import.meta.env.DEV && <ClusterLab />}
    </div>
  )
}
