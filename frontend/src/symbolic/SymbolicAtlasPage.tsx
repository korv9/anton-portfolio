/**
 * Symbolic Atlas: can recurring symbolic meanings be found in myth, folklore and literature
 * without deciding the meanings first? Every occurrence of twenty symbol words in ten public-
 * domain books is placed on a map by the similarity of its surrounding sentences (sentence
 * embeddings, UMAP) and grouped by HDBSCAN. Clusters are numbered, never named.
 *
 * The pipeline is platform/ingest/symbolic → dbt (bronze, silver, gold) → platform/nlp/symbolic
 * → platform/publish/symbolic; docs/symbolic-atlas.md describes it and its limits.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { Stage, StageBlock, StageFacts } from '../ui/Stage'
import AtlasCanvas from './AtlasCanvas'
import {
  AtlasFiltersPanel,
  SymbolPanel,
  traditionName,
  type AtlasFilters,
} from './AtlasSidebar'
import {
  loadAtlasPoints,
  loadAtlasSummary,
  loadSymbolProfiles,
} from './atlasData'
import type { AtlasPoint, AtlasSummary, SymbolProfile } from './atlasTypes'
import './symbolic.css'

const DEFAULTS: AtlasFilters = {
  symbol: '',
  tradition: '',
  cluster: '',
  noise: '1',
}
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
    return () => {
      live = false
    }
  }, [])

  const shown = useMemo(
    () => (points ?? []).filter((p) => filters.noise !== '0' || !p.is_noise),
    [points, filters.noise],
  )
  const isLit = useMemo(() => {
    const { symbol, tradition, cluster } = filters
    if (!symbol && !tradition && !cluster) return null
    return (p: AtlasPoint) =>
      (!symbol || p.symbol_id === symbol) &&
      (!tradition || p.tradition === tradition) &&
      (!cluster || p.cluster_id === Number(cluster))
  }, [filters.symbol, filters.tradition, filters.cluster])
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
            <AtlasCanvas
              points={shown}
              isLit={isLit}
              selected={picked?.occurrence_id ?? null}
              onPinned={setPinned}
              onPick={(p) => {
                setPicked(p)
                setFilters({ symbol: p.symbol_id })
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
            />
          </>
        }
        right={
          <>
            {picked && (
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
            {filters.symbol ? (
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
                    [
                      l('Occurrences found', 'Förekomster'),
                      num(summary.occurrence_count),
                    ],
                    [l('On the map', 'På kartan'), num(summary.point_count)],
                    [l('Clusters', 'Kluster'), num(summary.cluster_count)],
                    [l('Noise', 'Brus'), pct(summary.noise_share)],
                    [
                      l('Trustworthiness', 'Trovärdighet'),
                      num(ev.trustworthiness, 2),
                    ],
                    [
                      l('Silhouette', 'Silhuett'),
                      ev.silhouette == null ? '–' : num(ev.silhouette, 2),
                    ],
                  ]}
                />
              </StageBlock>
            )}
            <StageBlock
              title={l('What the clusters follow', 'Vad klustren följer')}
            >
              <p>
                {l(
                  `On average ${pct(ev.composition.largest_book_share ?? 0)} of a cluster comes from one book, and ${pct(ev.composition.largest_symbol_share ?? 0)} from one symbol. So far the map groups passages more by a book's style and translation than by what a symbol means. That is a finding, not a failure, and the next thing to work on.`,
                  `I genomsnitt kommer ${pct(ev.composition.largest_book_share ?? 0)} av ett kluster från en och samma bok, och ${pct(ev.composition.largest_symbol_share ?? 0)} från en och samma symbol. Än så länge grupperar kartan ställen mer efter bokens stil och översättning än efter vad en symbol betyder. Det är ett resultat, inte ett misslyckande, och nästa sak att arbeta med.`,
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Method', 'Metod')}>
              <p>
                {l(
                  `Ten Project Gutenberg books. Each use of a symbol word is cut out with the sentence before and after, embedded with ${summary.run.embedding_model.split('/')[1]} on the CPU, laid out with UMAP (cosine) and clustered with HDBSCAN in a 10-dimensional UMAP space. At most ${summary.run.sample.per_document_and_symbol} uses per book and symbol are mapped.`,
                  `Tio böcker från Project Gutenberg. Varje förekomst av ett symbolord klipps ut med meningen före och efter, bäddas in med ${summary.run.embedding_model.split('/')[1]} på processorn, läggs ut med UMAP (cosinus) och klustras med HDBSCAN i ett tiodimensionellt UMAP-rum. Högst ${summary.run.sample.per_document_and_symbol} förekomster per bok och symbol visas.`,
                )}
              </p>
              <p>
                {l(
                  'Matching is by word list, so a context is not yet a symbolic meaning; clusters are exploratory, numbered and unnamed, and UMAP bends distances.',
                  'Matchningen sker med en ordlista, så ett sammanhang är ännu inte en symbolisk betydelse; klustren är utforskande, numrerade och namnlösa, och UMAP förvränger avstånd.',
                )}
              </p>
            </StageBlock>
          </>
        }
      />
    </div>
  )
}
