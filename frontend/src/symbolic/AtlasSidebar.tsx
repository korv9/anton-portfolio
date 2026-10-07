/**
 * Filters for the atlas (symbol, tradition, cluster, noise) and what is known about the chosen
 * symbol: how many times it occurs, which clusters hold it and in which traditions.
 */
import { l } from '../i18n'
import { count, share } from '../format'
import { StageBlock, StageFacts } from '../ui/Stage'
import { TRADITION, clusterColour } from './atlasData'
import type { AtlasPoint, AtlasSummary, SymbolProfile } from './atlasTypes'

export type AtlasFilters = {
  symbol: string
  tradition: string
  cluster: string
  noise: string
}

const num = count
const pct = share
export const traditionName = (key: string) =>
  TRADITION[key] ? l(...TRADITION[key]) : key

export function AtlasFiltersPanel({
  summary,
  filters,
  set,
  clusters,
}: {
  summary: AtlasSummary
  filters: AtlasFilters
  set: (changes: Partial<AtlasFilters>) => void
  /** The clusters of the view, when not the baseline's (the book-centred run). */
  clusters?: { id: number; size: number; name: string }[]
}) {
  const options =
    clusters ??
    summary.clusters
      .filter((c) => c >= 0)
      .map((c) => ({
        id: c,
        size: summary.evaluation.cluster_sizes[String(c)],
        name: l(`Cluster ${c}`, `Kluster ${c}`),
      }))
  return (
    <>
      <StageBlock title={l('Symbol', 'Symbol')}>
        <div
          className="atlas-chips"
          role="group"
          aria-label={l('Symbol', 'Symbol')}
        >
          {summary.symbols.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={filters.symbol === s.id}
              onClick={() =>
                set({ symbol: filters.symbol === s.id ? '' : s.id })
              }
            >
              {s.id}
            </button>
          ))}
        </div>
      </StageBlock>
      <StageBlock title={l('Tradition', 'Tradition')}>
        <div
          className="atlas-chips"
          role="group"
          aria-label={l('Tradition', 'Tradition')}
        >
          {summary.traditions.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={filters.tradition === t}
              onClick={() =>
                set({ tradition: filters.tradition === t ? '' : t })
              }
            >
              {traditionName(t)}
            </button>
          ))}
        </div>
      </StageBlock>
      <StageBlock title={l('Cluster', 'Kluster')}>
        <label className="atlas-select">
          <span className="visually-hidden">{l('Cluster', 'Kluster')}</span>
          <select
            value={filters.cluster}
            onChange={(e) => set({ cluster: e.target.value })}
          >
            <option value="">{l('All clusters', 'Alla kluster')}</option>
            {options.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} ({c.size})
              </option>
            ))}
          </select>
        </label>
        <label className="atlas-check">
          <input
            type="checkbox"
            checked={filters.noise !== '0'}
            onChange={(e) => set({ noise: e.target.checked ? '1' : '0' })}
          />
          {l('Show noise', 'Visa brus')} ({pct(summary.noise_share)})
        </label>
      </StageBlock>
    </>
  )
}

export function SymbolPanel({
  symbol,
  summary,
  points,
  profiles,
  onCluster,
}: {
  symbol: string
  summary: AtlasSummary
  points: AtlasPoint[]
  profiles: SymbolProfile[]
  onCluster: (cluster: number) => void
}) {
  const info = summary.symbols.find((s) => s.id === symbol)
  if (!info) return null
  const own = points.filter((p) => p.symbol_id === symbol)
  const clusters = profiles
    .filter((p) => p.symbol_id === symbol)
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
  const traditions = new Map<string, number>()
  for (const p of own)
    traditions.set(p.tradition, (traditions.get(p.tradition) ?? 0) + 1)
  return (
    <>
      <StageBlock title={info.label}>
        <StageFacts
          rows={[
            [l('In the corpus', 'I korpusen'), num(info.occurrences)],
            [l('On the map', 'På kartan'), num(info.points)],
            [
              l('Clusters', 'Kluster'),
              num(clusters.filter((c) => c.cluster_id >= 0).length),
            ],
          ]}
        />
      </StageBlock>
      <StageBlock title={l('Across clusters', 'Över klustren')}>
        <ul className="atlas-bars">
          {clusters.slice(0, 8).map((c) => (
            <li key={c.cluster_id}>
              <button
                type="button"
                onClick={() => onCluster(c.cluster_id)}
                disabled={c.cluster_id < 0}
              >
                <span>
                  {c.cluster_id < 0 ? l('noise', 'brus') : `#${c.cluster_id}`}
                </span>
                <i>
                  <b
                    style={{
                      width: `${c.share_within_symbol * 100}%`,
                      background: clusterColour(c.cluster_id),
                    }}
                  />
                </i>
                <em>{pct(c.share_within_symbol)}</em>
              </button>
            </li>
          ))}
        </ul>
      </StageBlock>
      <StageBlock title={l('Traditions', 'Traditioner')}>
        <StageFacts
          rows={[...traditions]
            .sort((a, b) => b[1] - a[1])
            .map(([t, count]) => [traditionName(t), num(count)])}
        />
      </StageBlock>
    </>
  )
}
