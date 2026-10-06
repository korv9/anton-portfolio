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
  translator?: string | null
  culture?: string
  region?: string
  genre?: string
  source_type?: string
  period?: string
  pilot?: boolean
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

/** The book-centred map of the same points (book-centered-atlas.parquet). */
export type BookCenteredPoint = {
  occurrence_id: string
  x: number
  y: number
  cluster_id: number
  cluster_probability: number
  is_noise: boolean
}

/**
 * One book-centred cluster (book-centered-clusters.json). review_class is the automatic audit
 * (candidate, warning, reject); review_status says whether a person has read it. Neither names
 * it: only a reviewed cluster in reviewed-clusters.json has a label.
 */
export type ClusterInfo = {
  cluster_id: number
  cluster_fingerprint: string
  occurrence_count: number
  book_count: number
  tradition_count: number
  symbol_count: number
  largest_book: string
  largest_book_share: number
  largest_tradition: string
  largest_tradition_share: number
  largest_symbol: string
  largest_symbol_share: number
  book_entropy: number
  tradition_entropy: number
  symbol_entropy: number
  avg_membership_probability: number
  cross_book_cluster: boolean
  suspected_paratext: boolean
  book_dominated: boolean
  too_small: boolean
  low_membership: boolean
  review_class: 'candidate' | 'warning' | 'reject'
  review_status: 'unreviewed' | 'candidate' | 'reviewed' | 'rejected'
  review_priority_score: number
  top_symbols: { symbol_id: string; share: number }[]
  top_traditions: { tradition: string; share: number }[]
  representatives: { centroid: string[]; diverse: string[] }
}

export type ClusterFile = {
  experiment: string
  note: string
  clusters: ClusterInfo[]
}

/** A cluster a person has reviewed (reviewed-clusters.json). Written by hand, never generated. */
export type ReviewedCluster = {
  cluster_id: number
  fingerprint: string
  label: string
  description: string
  interpretation: string | null
  confidence: 'low' | 'medium' | 'high'
  book_count: number
  tradition_count: number
  symbol_count: number
  representative_occurrence_ids: string[]
}

export type StepMetrics = {
  occurrences: number
  clusters: number
  noise_share: number
  mean_largest_book_share: number
  mean_book_entropy: number
  cross_book_cluster_count: number
  cross_book_occurrence_share: number
  silhouette: number | null
  trustworthiness: number
  median_membership: number | null
}

type ParatextCount = {
  clusters: number
  suspected_paratext_clusters: number
  suspected_paratext_occurrence_share: number
}

/** What the clusters follow (platform/nlp/symbolic/validity.py). */
export type ValidityRun = {
  points: number
  clustered: number
  english_voices: number
  /** Adjusted mutual information between cluster and each property, 0 = chance. */
  association_ami: Record<string, number>
  book_pairs: {
    books: number
    min_points: number
    mean_similarity: Record<string, { pairs: number; mean: number }>
  }
}
export type Validity = {
  method: string
  not_measured: Record<string, string>
  experiments: Record<string, ValidityRun>
}

/** The investigation step by step (research-history.json). */
export type ResearchHistory = {
  steps: {
    id: 'v1' | 'v2' | 'v3' | 'v4'
    name: string
    metrics: StepMetrics | null
    baseline_metrics?: StepMetrics | null
    documents?: number
  }[]
  validity?: Validity | null
  cleaning: {
    old_occurrence_count: number | null
    new_occurrence_count: number
    removed_occurrences: number | null
    documents_affected: number
    documents: {
      document_id: string
      removed_share: number
      sections_removed: string[]
      footnote_blocks_removed: number
    }[]
  } | null
  paratext_clusters: Record<
    string,
    { before: ParatextCount; after: ParatextCount }
  >
  review: {
    cluster_count: number
    candidate_cluster_count: number
    warning_cluster_count: number
    rejected_by_flags_count: number
    reviewed_cluster_count: number
    rejected_cluster_count: number
    suspected_paratext_count: number
    cross_book_cluster_count: number
  }
}
