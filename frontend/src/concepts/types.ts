/** The concept layer's published files (platform/publish/concepts/export_concepts.py). */

export type Concept = {
  concept_id: string
  label_en: string
  label_sv: string
  family: string
  description_en: string
  description_sv: string
  anchor_en: string
  anchor_sv: string
  status: string
  created_by: string
  method: string
}

export type Corpus = {
  corpus_id: string
  label_en: string
  label_sv: string
  stage: string
  language: string
  description_en: string
  domain: string
  chunks: number
  documents: number
  first_retrieved_at: string
  last_retrieved_at: string
}

export type RelationType = {
  id: string
  content_type: 'source' | 'derived' | 'interpretation'
  en: string
  sv: string
}

export type ConceptSummary = {
  concepts: Concept[]
  corpora: Corpus[]
  relation_types: RelationType[]
  run: {
    model: string
    chunks: Record<string, number>
    corpus_size: number
    words: [number, number]
    concepts: number
    top_rank: number
    representatives: number
    act_version: string
    baselines: Record<string, { mean: number; p95: number }>
    evaluation: {
      same_corpus_neighbours: number
      same_corpus_chance: number
      same_corpus_neighbours_centred: number
      same_language_neighbours: number
      same_language_chance: number
      anchor_agreement_sv_en: number
      mean_similarity_by_corpus: Record<string, number>
    }
    ran_at: string
  }
  reviewed_cluster_links: number
}

export type Profile = {
  concept_id: string
  corpus_id: string
  chunks: number
  rank1_chunks: number
  top3_chunks: number
  rank1_share: number
  top3_share: number
  rank1_chance: number
  rank1_lift: number
}

export type ConceptRelation = {
  concept_a: string
  concept_b: string
  relation_type: 'semantic_similarity' | 'shared_tension'
  strength: number | null
  tension_id: string | null
  content_type: string
}

export type CorpusRelation = {
  from: string
  to: string
  relation_type: 'documented_reference' | 'temporal_overlap'
  count: number
  first: string
  last: string
  en: string
  sv: string
  route: string
}

export type Relations = {
  concepts: ConceptRelation[]
  corpora: CorpusRelation[]
}

export type Passage = {
  representative_rank: number
  similarity: number
  rank: number
  z_score: number
  chunk_id: string
  language: string
  document_title: string
  location: string
  source_url: string
  source_version: string
  retrieved_at: string
  period: string | null
  text: string
}

export type Pair = {
  concept_id: string
  corpus_a: string
  corpus_b: string
  similarity: number
  baseline_mean: number
  baseline_p95: number
  text_a: string
  title_a: string
  location_a: string
  url_a: string
  language_a: string
  text_b: string
  title_b: string
  location_b: string
  url_b: string
  language_b: string
}

export type Link = {
  concept_id: string
  kind: 'philosophy_tension' | 'riksdag_framing' | 'ai_act_view' | 'job_term'
  target_id: string
  note: string | null
  target?: {
    label_en: string
    label_sv: string
    periods?: Record<
      string,
      { ai_speeches: number; with_concept: number; share: number }
    >
    years?: { year: number; ads: number; with_term: number; share: number }[]
  } | null
}
