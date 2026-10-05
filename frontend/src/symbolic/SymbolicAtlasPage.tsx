/**
 * Symbolic Atlas: can recurring symbolic meanings be found in myth, folklore and literature
 * without deciding the meanings first? Every occurrence of twenty symbol words in ten public-
 * domain books is placed on a map by the similarity of its surrounding sentences (sentence
 * embeddings, UMAP) and grouped by HDBSCAN. Clusters are numbered; only a cluster a person has
 * reviewed (reviewed-clusters.json) is ever named.
 *
 * Three views of the same points: Baseline (the original embeddings), Cross-book (each book's
 * mean removed, book-bound clusters muted, cross-book candidates and reviewed clusters brought
 * forward) and Reviewed (only clusters a person has read and named).
 *
 * The pipeline is platform/ingest/symbolic → dbt (bronze, silver, gold) → platform/nlp/symbolic
 * → platform/publish/symbolic; docs/symbolic-atlas.md describes it and its limits.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { Stage, StageBlock, StageFacts } from '../ui/Stage'
import AtlasCanvas, { type MapLabel, type Paint } from './AtlasCanvas'
import ClusterPanel, { clusterTitle } from './ClusterPanel'
import ExperimentTable from './ExperimentTable'
import ResearchStory from './ResearchStory'
import { ProjectNav } from '../projects/ProjectNav'
import {
  AtlasFiltersPanel,
  SymbolPanel,
  traditionName,
  type AtlasFilters,
} from './AtlasSidebar'
import {
  clusterColour,
  loadAtlasPoints,
  loadAtlasSummary,
  loadBookCenteredAtlas,
  loadBookCenteredClusters,
  loadResearchHistory,
  loadReviewedClusters,
  loadSymbolProfiles,
} from './atlasData'
import type {
  AtlasPoint,
  AtlasSummary,
  BookCenteredPoint,
  ClusterInfo,
  ResearchHistory,
  ReviewedCluster,
  SymbolProfile,
} from './atlasTypes'
import './symbolic.css'

type View = 'baseline' | 'cross-book' | 'reviewed'
const VIEWS: { key: View; name: [string, string]; hint: [string, string] }[] = [
  {
    key: 'baseline',
    name: ['Baseline', 'Utgångsläge'],
    hint: [
      'The original embeddings: clusters largely follow books.',
      'De ursprungliga inbäddningarna: klustren följer till stor del böckerna.',
    ],
  },
  {
    key: 'cross-book',
    name: ['Cross-book', 'Över böcker'],
    hint: [
      'Each book’s mean removed. Book-bound clusters are muted; clusters spread over several books stand out.',
      'Varje boks medelvärde borttaget. Bokbundna kluster tonas ned; kluster som sprids över flera böcker framträder.',
    ],
  },
  {
    key: 'reviewed',
    name: ['Reviewed', 'Granskade'],
    hint: [
      'Only clusters a person has read and named.',
      'Bara kluster som en människa har läst och namngett.',
    ],
  },
]
const DEFAULTS: AtlasFilters & { view: string } = {
  symbol: '',
  tradition: '',
  cluster: '',
  noise: '1',
  view: 'baseline',
}
const MUTED = 'rgba(170, 165, 158, 0.32)'
const NOISE = 'rgba(150, 146, 140, 0.16)'
const num = (v: number, d = 0) =>
  v.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
const pct = (v: number) => `${num(v * 100)} %`

export default function SymbolicAtlasPage({ route }: { route: Route }) {
  const [summary, setSummary] = useState<AtlasSummary | null>(null)
  const [points, setPoints] = useState<AtlasPoint[] | null>(null)
  const [profiles, setProfiles] = useState<SymbolProfile[]>([])
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<AtlasPoint | null>(null)
  const [pinned, setPinned] = useState(0)
  const [filters, setFilters] = useViewParams(route, DEFAULTS)
  const [centred, setCentred] = useState<BookCenteredPoint[] | null>(null)
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo[]>([])
  const [reviewed, setReviewed] = useState<ReviewedCluster[]>([])
  const [history, setHistory] = useState<ResearchHistory | null>(null)
  const view: View = (
    ['cross-book', 'reviewed'].includes(filters.view)
      ? filters.view
      : 'baseline'
  ) as View
  const bookView = view !== 'baseline' && centred !== null

  useEffect(() => {
    let live = true
    Promise.all([loadAtlasSummary(), loadAtlasPoints(), loadSymbolProfiles()])
      .then(([s, p, pr]) => {
        if (!live) return
        setSummary(s)
        setPoints(p)
        setProfiles(pr)
      })
      .catch(() => live && setFailed(true))
    // The review layer is optional: without it the page is the baseline atlas.
    Promise.all([
      loadBookCenteredAtlas(),
      loadBookCenteredClusters(),
      loadReviewedClusters(),
      loadResearchHistory(),
    ]).then(([bc, info, rev, hist]) => {
      if (!live) return
      setCentred(bc)
      setClusterInfo(info?.clusters ?? [])
      setReviewed(rev?.clusters ?? [])
      setHistory(hist)
    })
    return () => {
      live = false
    }
  }, [])

  // A section address (#symbolic-findings, -experiments, -method) scrolls to its section once
  // the page has rendered it; the experiment table loads on its own, so wait a few frames.
  const loaded = summary !== null && points !== null
  useEffect(() => {
    if (!loaded || route.path === '#symbolic-atlas') return
    let tries = 0
    let frame = 0
    let timers: number[] = []
    let touched = false
    const stop = () => (touched = true)
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown']
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }))
    const go = () => {
      const target = document.getElementById(route.path.slice(1))
      if (!target) {
        if (tries++ < 60) frame = requestAnimationFrame(go)
        return
      }
      const land = () => {
        if (!touched)
          target.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
      land()
      // The map sizes itself after the first paint and pushes the sections down; land again
      // a few times while that settles, unless the reader has started to move.
      timers = [300, 700, 1200].map((ms) => window.setTimeout(land, ms))
    }
    frame = requestAnimationFrame(go)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach((t) => window.clearTimeout(t))
      events.forEach((e) => window.removeEventListener(e, stop))
    }
  }, [route.path, loaded])

  const byId = useMemo(
    () => new Map((points ?? []).map((p) => [p.occurrence_id, p])),
    [points],
  )
  // The book-centred views move the same points to their book-centred place and cluster.
  const mapped = useMemo(() => {
    if (!bookView || !centred) return points ?? []
    return centred.flatMap((c) => {
      const p = byId.get(c.occurrence_id)
      return p ? [{ ...p, ...c }] : []
    })
  }, [bookView, centred, points, byId])
  const shown = useMemo(
    () => mapped.filter((p) => filters.noise !== '0' || !p.is_noise),
    [mapped, filters.noise],
  )
  const infoById = useMemo(
    () => new Map(clusterInfo.map((c) => [c.cluster_id, c])),
    [clusterInfo],
  )
  const reviewedById = useMemo(
    () => new Map(reviewed.map((r) => [r.cluster_id, r])),
    [reviewed],
  )
  const selectedCluster =
    bookView && filters.cluster !== '' ? Number(filters.cluster) : null
  // Background muted, cross-book candidates visible, reviewed strongest, the chosen one on top.
  const paint = useMemo(() => {
    if (!bookView) return undefined
    return (p: AtlasPoint): Paint => {
      if (p.is_noise) return { fill: NOISE, r: 1.2, layer: 0 }
      if (p.cluster_id === selectedCluster)
        return { fill: clusterColour(p.cluster_id, 1), r: 3, layer: 4 }
      if (reviewedById.has(p.cluster_id))
        return { fill: clusterColour(p.cluster_id, 1), r: 2.8, layer: 3 }
      const info = infoById.get(p.cluster_id)
      if (view === 'cross-book' && info?.review_class === 'candidate')
        return { fill: clusterColour(p.cluster_id, 0.8), r: 2.1, layer: 2 }
      return { fill: MUTED, r: 1.5, layer: 1 }
    }
  }, [bookView, selectedCluster, reviewedById, infoById, view])
  const labels = useMemo((): MapLabel[] => {
    if (!bookView) return []
    return reviewed.flatMap((r) => {
      const own = mapped.filter((p) => p.cluster_id === r.cluster_id)
      if (!own.length) return []
      const x = own.reduce((t, p) => t + p.x, 0) / own.length
      const y = own.reduce((t, p) => t + p.y, 0) / own.length
      return [{ x, y, text: r.label }]
    })
  }, [bookView, reviewed, mapped])
  const isLit = useMemo(() => {
    const { symbol, tradition, cluster } = filters
    const onlyReviewed = view === 'reviewed' && bookView
    if (!symbol && !tradition && !cluster && !onlyReviewed) return null
    return (p: AtlasPoint) =>
      (!onlyReviewed || reviewedById.has(p.cluster_id)) &&
      (!symbol || p.symbol_id === symbol) &&
      (!tradition || p.tradition === tradition) &&
      (!cluster || p.cluster_id === Number(cluster))
  }, [
    filters.symbol,
    filters.tradition,
    filters.cluster,
    view,
    bookView,
    reviewedById,
  ])
  const litCount = isLit ? shown.filter(isLit).length : shown.length

  if (failed)
    return (
      <p className="ds-container" role="alert">
        {l('The atlas could not be loaded.', 'Atlasen kunde inte laddas.')}
      </p>
    )
  if (!summary || !points)
    return (
      <p className="ds-container" role="status">
        {l('Loading the atlas…', 'Laddar atlasen…')}
      </p>
    )

  const ev = summary.evaluation
  return (
    <div className="symbolic-page">
      <ProjectNav route={route} />
      <Stage
        id="symbolic-atlas"
        level={1}
        kicker="Symbolic Atlas"
        title={l(
          'Can recurring symbolic meanings emerge without predefined categories?',
          'Kan återkommande symbolisk mening träda fram utan förbestämda kategorier?',
        )}
        lead={l(
          'An unsupervised exploration of mythology, folklore and literature: every dot is one use of a symbol word, placed by what the sentences around it say.',
          'En oövervakad utforskning av mytologi, folksagor och litteratur: varje prick är en förekomst av ett symbolord, placerad efter vad meningarna runt det säger.',
        )}
        figure={
          <div className="atlas-figure">
            {centred && (
              <div className="atlas-views">
                <div
                  className="atlas-chips"
                  role="group"
                  aria-label={l('View', 'Vy')}
                >
                  {VIEWS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      aria-pressed={view === v.key}
                      onClick={() => {
                        setPicked(null)
                        setFilters({ view: v.key, cluster: '' })
                      }}
                    >
                      {l(...v.name)}
                    </button>
                  ))}
                </div>
                <p className="atlas-view-hint">
                  {l(...VIEWS.find((v) => v.key === view)!.hint)}
                </p>
                {view === 'reviewed' && reviewed.length === 0 && (
                  <p className="atlas-empty" role="status">
                    {l(
                      'No reviewed semantic clusters yet.',
                      'Inga granskade semantiska kluster ännu.',
                    )}
                  </p>
                )}
              </div>
            )}
            <AtlasCanvas
              points={shown}
              isLit={isLit}
              selected={picked?.occurrence_id ?? null}
              onPinned={setPinned}
              paint={paint}
              labels={labels}
              clusterName={
                bookView
                  ? (c) => clusterTitle(c, reviewedById.get(c))
                  : undefined
              }
              onPick={(p) => {
                setPicked(p)
                if (bookView && !p.is_noise)
                  setFilters({ cluster: String(p.cluster_id) })
                else setFilters({ symbol: p.symbol_id })
              }}
            />
            <p className="atlas-status" aria-live="polite">
              {isLit
                ? l(
                    `${num(litCount)} of ${num(shown.length)} points match the filters.`,
                    `${num(litCount)} av ${num(shown.length)} punkter matchar filtren.`,
                  )
                : l(
                    `${num(shown.length)} points. Point at one to read it; choose a symbol to see where it falls.`,
                    `${num(shown.length)} punkter. Peka på en för att läsa den; välj en symbol för att se var den hamnar.`,
                  )}
              {pinned > 0 &&
                l(
                  ` ${num(pinned)} points far from the rest are drawn as rings at the edge.`,
                  ` ${num(pinned)} punkter långt från resten ritas som ringar vid kanten.`,
                )}
            </p>
          </div>
        }
        left={
          <>
            <h2 className="visually-hidden">{l('Filters', 'Filter')}</h2>
            <AtlasFiltersPanel
              summary={summary}
              filters={filters}
              set={setFilters}
              clusters={
                bookView
                  ? clusterInfo.map((c) => ({
                      id: c.cluster_id,
                      size: c.occurrence_count,
                      name: clusterTitle(
                        c.cluster_id,
                        reviewedById.get(c.cluster_id),
                      ),
                    }))
                  : undefined
              }
            />
          </>
        }
        right={
          <>
            {selectedCluster !== null && infoById.get(selectedCluster) && (
              <ClusterPanel
                info={infoById.get(selectedCluster)!}
                reviewed={reviewedById.get(selectedCluster)}
                passages={byId}
                onClose={() => {
                  setPicked(null)
                  setFilters({ cluster: '' })
                }}
              />
            )}
            {selectedCluster === null && picked && (
              <StageBlock title={l('The chosen passage', 'Det valda stället')}>
                <p className="atlas-quote">{picked.context}</p>
                <StageFacts
                  rows={[
                    [l('Word', 'Ord'), picked.matched_term],
                    [l('Book', 'Bok'), picked.title.split(':')[0]],
                    [
                      l('Tradition', 'Tradition'),
                      traditionName(picked.tradition),
                    ],
                    [
                      l('Cluster', 'Kluster'),
                      picked.is_noise
                        ? l('noise', 'brus')
                        : `#${picked.cluster_id} · ${pct(picked.cluster_probability)}`,
                    ],
                  ]}
                />
              </StageBlock>
            )}
            {selectedCluster !== null ? null : filters.symbol ? (
              <SymbolPanel
                symbol={filters.symbol}
                summary={summary}
                points={points}
                profiles={profiles}
                onCluster={(c) => setFilters({ cluster: String(c) })}
              />
            ) : (
              <StageBlock title={l('The run', 'Körningen')}>
                <StageFacts
                  rows={[
                    [l('Books', 'Böcker'), num(summary.document_count)],
                    [l('Symbols', 'Symboler'), num(summary.symbol_count)],
                    [l('On the map', 'På kartan'), num(summary.point_count)],
                    ...(history?.steps[2]?.metrics && history.steps[0]?.metrics
                      ? ([
                          [
                            l(
                              'Largest book, baseline',
                              'Största bok, utgångsläge',
                            ),
                            pct(
                              history.steps[0].metrics.mean_largest_book_share,
                            ),
                          ],
                          [
                            l(
                              'Largest book, book-centred',
                              'Största bok, bokcentrerad',
                            ),
                            pct(
                              history.steps[2].metrics.mean_largest_book_share,
                            ),
                          ],
                          [
                            l(
                              'Cross-book clusters',
                              'Kluster över flera böcker',
                            ),
                            `${history.steps[2].metrics.cross_book_cluster_count} / ${history.steps[2].metrics.clusters}`,
                          ],
                          [
                            l('Reviewed clusters', 'Granskade kluster'),
                            num(history.review.reviewed_cluster_count),
                          ],
                        ] as [string, string][])
                      : ([
                          [
                            l('Clusters', 'Kluster'),
                            num(summary.cluster_count),
                          ],
                          [
                            l('Largest book', 'Största bok'),
                            pct(ev.composition.largest_book_share ?? 0),
                          ],
                        ] as [string, string][])),
                  ]}
                />
              </StageBlock>
            )}
          </>
        }
      />
      {history ? (
        <ResearchStory history={history} />
      ) : (
        <section
          className="atlas-section ds-container"
          id="symbolic-findings"
          aria-labelledby="symbolic-findings-title"
        >
          <h2 id="symbolic-findings-title">{l('Findings', 'Fynd')}</h2>
          <p>
            {l(
              `On average ${pct(ev.composition.largest_book_share ?? 0)} of a cluster comes from one book, and ${pct(ev.composition.largest_symbol_share ?? 0)} from one symbol. So far the map groups passages more by a book's style and translation than by what a symbol means. That is a finding, not a failure, and the next thing to work on.`,
              `I genomsnitt kommer ${pct(ev.composition.largest_book_share ?? 0)} av ett kluster från en och samma bok, och ${pct(ev.composition.largest_symbol_share ?? 0)} från en och samma symbol. Än så länge grupperar kartan ställen mer efter bokens stil och översättning än efter vad en symbol betyder. Det är ett resultat, inte ett misslyckande, och nästa sak att arbeta med.`,
            )}
          </p>
          <p>
            <a href="#symbolic-experiments">
              {l(
                'How far that can be reduced',
                'Hur mycket det går att minska',
              )}{' '}
              →
            </a>
          </p>
        </section>
      )}
      <ExperimentTable />
      <section
        className="atlas-section ds-container"
        id="symbolic-method"
        aria-labelledby="symbolic-method-title"
      >
        <h2 id="symbolic-method-title">{l('Method', 'Metod')}</h2>
        <p>
          {l(
            `Ten Project Gutenberg books. Each use of a symbol word is cut out with the sentence before and after, embedded with ${summary.run.embedding_model.split('/')[1]} on the CPU, laid out with UMAP (cosine) and clustered with HDBSCAN in a 10-dimensional UMAP space. At most ${summary.run.sample.per_document_and_symbol} uses per book and symbol are mapped.`,
            `Tio böcker från Project Gutenberg. Varje förekomst av ett symbolord klipps ut med meningen före och efter, bäddas in med ${summary.run.embedding_model.split('/')[1]} på processorn, läggs ut med UMAP (cosinus) och klustras med HDBSCAN i ett tiodimensionellt UMAP-rum. Högst ${summary.run.sample.per_document_and_symbol} förekomster per bok och symbol visas.`,
          )}
        </p>
        <p>
          {l(
            'Before extraction, contents, glossaries, indexes, notes, bibliographies and footnotes are removed by explicit rules, and each removal is recorded. Matching is by word list, so a context is not yet a symbolic meaning; clusters are exploratory and numbered, a name comes only from a person’s review, and UMAP bends distances.',
            'Före extraktionen tas innehållsförteckningar, ordlistor, register, noter, litteraturlistor och fotnoter bort med uttryckliga regler, och varje borttagning registreras. Matchningen sker med en ordlista, så ett sammanhang är ännu inte en symbolisk betydelse; klustren är utforskande och numrerade, ett namn kommer bara från en människas granskning, och UMAP förvränger avstånd.',
          )}
        </p>
        <h3>{l('Diagnostics', 'Diagnostik')}</h3>
        <p className="atlas-note">
          {l(
            'How well the map and the clusters hold together. These describe structure, not meaning.',
            'Hur väl kartan och klustren håller ihop. De beskriver struktur, inte betydelse.',
          )}
        </p>
        <div className="atlas-table-wrap">
          <table className="atlas-table">
            <thead>
              <tr>
                <th scope="col">{l('Run', 'Körning')}</th>
                <th scope="col">{l('Trustworthiness', 'Trovärdighet')}</th>
                <th scope="col">{l('Silhouette', 'Silhuett')}</th>
                <th scope="col">{l('Noise', 'Brus')}</th>
                <th scope="col">
                  {l('Median membership', 'Medianmedlemskap')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(history?.steps ?? [])
                .filter((st) => st.metrics)
                .map((st) => (
                  <tr key={st.id}>
                    <th scope="row">
                      {st.id} · {st.name}
                    </th>
                    <td>{num(st.metrics!.trustworthiness, 2)}</td>
                    <td>
                      {st.metrics!.silhouette == null
                        ? '–'
                        : num(st.metrics!.silhouette, 2)}
                    </td>
                    <td>{pct(st.metrics!.noise_share)}</td>
                    <td>
                      {st.metrics!.median_membership == null
                        ? '–'
                        : num(st.metrics!.median_membership, 2)}
                    </td>
                  </tr>
                ))}
              {!history && (
                <tr>
                  <th scope="row">{l('Baseline', 'Utgångsläge')}</th>
                  <td>{num(ev.trustworthiness, 2)}</td>
                  <td>{ev.silhouette == null ? '–' : num(ev.silhouette, 2)}</td>
                  <td>{pct(summary.noise_share)}</td>
                  <td>
                    {ev.membership_probability
                      ? num(ev.membership_probability.median, 2)
                      : '–'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p>
          <a
            href="https://github.com/korv9/anton-portfolio/blob/main/docs/symbolic-atlas.md"
            target="_blank"
            rel="noreferrer"
          >
            {l(
              'Full method and limitations',
              'Hela metoden och begränsningarna',
            )}{' '}
            ↗
          </a>
        </p>
      </section>
    </div>
  )
}
