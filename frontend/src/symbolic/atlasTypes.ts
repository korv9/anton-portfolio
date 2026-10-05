/** The Symbolic Atlas's delivered data (platform/publish/symbolic/export_symbolic.py). */

export type AtlasPoint = {
  occurrence_id: string
  symbol_id: string
  document_id: string
  title: string
  tradition: string
  matched_term: string
  /** A short excerpt of the three-sentence context, centred on the word. */
  context: string
  x: number
  y: number
  /** HDBSCAN cluster, numbered and never named; -1 is noise. */
  cluster_id: number
  cluster_probability: number
  is_noise: boolean
}

export type SymbolSummary = {
  id: string
  label: string
  /** Points on the atlas (after sampling). */
  points: number
  /** Every occurrence found in the corpus. */
  occurrences: number
}

export type SymbolProfile = {
  symbol_id: string
  cluster_id: number
  occurrence_count: number
  share_within_symbol: number
  avg_cluster_probability: number
}

export type AtlasDocument = {
  id: string
  title: string
  author: string
  tradition: string
  words: number
  gutenberg_id: number
  source_url: string
  points: number
}

export type AtlasSummary = {
  document_count: number
  occurrence_count: number
  point_count: number
  symbol_count: number
  cluster_count: number
  noise_share: number
  symbols: SymbolSummary[]
  traditions: string[]
  documents: AtlasDocument[]
  clusters: number[]
  run: {
    run_at: string
    embedding_model: string
    dimensions: number
    sample: { per_document_and_symbol: number; order: string }
    umap_map: Record<string, string | number>
    umap_cluster_space: Record<string, string | number>
    hdbscan: Record<string, string | number>
  }
  evaluation: {
    trustworthiness: number
    silhouette: number | null
    membership_probability: { q25: number; median: number; q75: number } | null
    composition: {
      largest_book_share: number | null
      largest_symbol_share: number | null
    }
    cluster_sizes: Record<string, number>
  }
}

export type AtlasPreview = {
  columns: ['x', 'y', 'cluster_id']
  points: [number, number, number][]
}

/** One row per deconfounding experiment (platform/nlp/symbolic/experiments.py). */
export type ExperimentRow = {
  experiment: string
  occurrences: number
  clusters: number
  noise_share: number
  trustworthiness: number
  silhouette: number | null
  median_membership: number | null
  mean_largest_book_share: number
  mean_largest_tradition_share: number
  mean_largest_symbol_share: number
  mean_book_entropy: number
  mean_tradition_entropy: number
  mean_symbol_entropy: number
  cross_book_cluster_count: number
  cross_book_occurrence_share: number
}

export type ExperimentComparison = {
  sample_sha256: string
  experiments: ExperimentRow[]
}
