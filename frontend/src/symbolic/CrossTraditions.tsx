/**
 * Contexts that cross traditions: the audit's top-ranked cross-book clusters
 * (cross-book-clusters.json, by review_priority_score), each shown as data only (its leading
 * symbol, how many books and traditions it draws on, the largest book's share) with two
 * representative passages from different books. Nothing here claims what a cluster means.
 */
import { l } from '../i18n'
import { share } from '../format'
import { traditionName } from './AtlasSidebar'
import type { AtlasPoint, ClusterInfo } from './atlasTypes'

const SHOWN = 6

export default function CrossTraditions({
  clusters,
  passages,
  onOpen,
}: {
  clusters: ClusterInfo[]
  /** Points by occurrence id, for the representative passages' text. */
  passages: Map<string, AtlasPoint>
  onOpen: (clusterId: number) => void
}) {
  const top = clusters
    .filter((c) => c.review_class === 'candidate')
    .sort((a, b) => b.review_priority_score - a.review_priority_score)
    .slice(0, SHOWN)
  if (!top.length) return null
  return (
    <section
      className="cross-traditions report-section"
      aria-labelledby="cross-traditions-title"
    >
      <h2 id="cross-traditions-title">
        {l('Contexts that cross traditions', 'Sammanhang över traditionerna')}
      </h2>
      <p>
        {l(
          'The audit’s highest-ranked clusters after book-centring. Each draws on many books and traditions, and no single book supplies much of it. They are recurring contexts, shown as data with two passages each, not meanings.',
          'Granskningens högst rankade kluster efter bokcentreringen. Vart och ett hämtar ur många böcker och traditioner, och ingen enskild bok står för mycket av det. De är återkommande sammanhang, visade som data med två ställen vardera, inte betydelser.',
        )}
      </p>
      <ol className="cross-cards">
        {top.map((c) => {
          const seen = new Set<string>()
          const reps = c.representatives.diverse
            .map((id) => passages.get(id))
            .filter((p): p is AtlasPoint => {
              if (!p || seen.has(p.document_id)) return false
              seen.add(p.document_id)
              return true
            })
            .slice(0, 2)
          return (
            <li key={c.cluster_id} className="cross-card">
              <h3>
                <code>#{c.cluster_id}</code> · {c.largest_symbol}{' '}
                {share(c.largest_symbol_share)}
              </h3>
              <p className="cross-facts">
                {l(
                  `${c.book_count} books · ${c.tradition_count} traditions · largest book ${share(c.largest_book_share)} · ${c.occurrence_count} passages`,
                  `${c.book_count} böcker · ${c.tradition_count} traditioner · största bok ${share(c.largest_book_share)} · ${c.occurrence_count} ställen`,
                )}
              </p>
              <ol className="cluster-passages">
                {reps.map((p) => (
                  <li key={p.occurrence_id}>
                    <q>{p.context}</q>
                    <small>
                      {p.matched_term}, {p.title.split(':')[0]},{' '}
                      {traditionName(p.tradition)}
                    </small>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="cluster-close"
                onClick={() => onOpen(c.cluster_id)}
              >
                {l('Show on the map', 'Visa på kartan')}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
