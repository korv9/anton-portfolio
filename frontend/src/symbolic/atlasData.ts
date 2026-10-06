/**
 * Loading the Symbolic Atlas. The summary and the start-page preview are JSON served with the
 * site; the points and the symbol profiles are Parquet on object storage, read through the
 * delivery manifest (dataSource.ts, parquet.ts), never by a hard-coded URL.
 */
import { fetchData } from '../dataSource'
import { readParquet } from '../parquet'
import type {
  AtlasPoint,
  AtlasPreview,
  AtlasSummary,
  BookCenteredPoint,
  ClusterFile,
  ExperimentComparison,
  ResearchHistory,
  ReviewedCluster,
  SymbolProfile,
} from './atlasTypes'

async function json<T>(path: string): Promise<T> {
  const response = await fetchData(path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

// Parquet integers can arrive as BigInt; the page wants plain numbers.
const n = (v: unknown) => (typeof v === 'bigint' ? Number(v) : (v as number))

export const loadAtlasSummary = () =>
  json<AtlasSummary>('symbolic/summary.json')

export const loadAtlasPreview = () =>
  json<AtlasPreview>('symbolic/preview.json')

export async function loadAtlasPoints(): Promise<AtlasPoint[]> {
  const rows = await readParquet('symbolic/atlas.parquet')
  return rows.map((r) => ({
    occurrence_id: String(r.occurrence_id),
    symbol_id: String(r.symbol_id),
    document_id: String(r.document_id),
    title: String(r.title),
    tradition: String(r.tradition),
    matched_term: String(r.matched_term),
    context: String(r.context),
    x: n(r.x),
    y: n(r.y),
    cluster_id: n(r.cluster_id),
    cluster_probability: n(r.cluster_probability),
    is_noise: Boolean(r.is_noise),
  }))
}

export async function loadSymbolProfiles(): Promise<SymbolProfile[]> {
  const rows = await readParquet('symbolic/symbol-profiles.parquet')
  return rows.map((r) => ({
    symbol_id: String(r.symbol_id),
    cluster_id: n(r.cluster_id),
    occurrence_count: n(r.occurrence_count),
    share_within_symbol: n(r.share_within_symbol),
    avg_cluster_probability: n(r.avg_cluster_probability),
  }))
}

/**
 * A colour per cluster. There are dozens of clusters and none has a name, so no legend can
 * list them: hues are spread by the golden angle so neighbouring ids differ, and identity is
 * read from the tooltip and the cluster filter. The hues are muted, so the map reads as one
 * field on the dark plate with clusters as tonal regions rather than a rainbow. Noise is grey.
 */
export function clusterColour(cluster: number, alpha = 1): string {
  if (cluster < 0) return `rgba(150, 146, 140, ${alpha * 0.55})`
  const hue = (cluster * 137.508) % 360
  const light = cluster % 2 ? 72 : 64
  return `hsla(${hue.toFixed(1)}, 24%, ${light}%, ${alpha})`
}

export const TRADITION: Record<string, [string, string]> = {
  norse: ['Norse', 'Nordisk'],
  finnish: ['Finnish', 'Finsk'],
  greek: ['Greek', 'Grekisk'],
  classical: ['Classical', 'Klassisk'],
  'european-folklore': ['European folklore', 'Europeisk folksaga'],
  celtic: ['Celtic', 'Keltisk'],
  'christian-literary': ['Christian, literary', 'Kristen, litterär'],
}

/** The experiment comparison, or null when the experiments have not been published. */
export async function loadExperimentComparison(): Promise<ExperimentComparison | null> {
  try {
    return await json<ExperimentComparison>(
      'symbolic/experiment-comparison.json',
    )
  } catch {
    return null
  }
}

/** The book-centred coordinates of the same points, or null when not published. */
export async function loadBookCenteredAtlas(): Promise<
  BookCenteredPoint[] | null
> {
  try {
    const rows = await readParquet('symbolic/book-centered-atlas.parquet')
    return rows.map((r) => ({
      occurrence_id: String(r.occurrence_id),
      x: n(r.x),
      y: n(r.y),
      cluster_id: n(r.cluster_id),
      cluster_probability: n(r.cluster_probability),
      is_noise: Boolean(r.is_noise),
    }))
  } catch {
    return null
  }
}

async function optional<T>(path: string): Promise<T | null> {
  try {
    return await json<T>(path)
  } catch {
    return null
  }
}

export const loadBookCenteredClusters = () =>
  optional<ClusterFile>('symbolic/book-centered-clusters.json')

/** Only clusters a person has reviewed; an empty list is a valid state. */
export const loadReviewedClusters = () =>
  optional<{ experiment: string; clusters: ReviewedCluster[] }>(
    'symbolic/reviewed-clusters.json',
  )

export const loadResearchHistory = () =>
  optional<ResearchHistory>('symbolic/research-history.json')
