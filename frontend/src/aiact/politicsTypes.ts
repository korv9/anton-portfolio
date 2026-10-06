/** The Riksdag ↔ AI Act analysis (platform/publish/ai_politics/export_ai_politics.py). */

export type PoliticsConcept = {
  concept_id: string
  kind: 'gate' | 'framing'
  label_en: string
  label_sv: string
  pattern: string
  case_sensitive: boolean
  description_en: string
  description_sv: string
  caveat_en: string | null
}

export type Phase = {
  id: string
  from?: string
  until?: string
  label_en: string
  label_sv: string
}

export type PoliticsSummary = {
  counts: {
    speeches: number
    ai_speeches: number
    ai_act_speeches: number
    ai_paragraphs: number
    sessions: number
  }
  first_date: string
  last_date: string
  source: { label: string; url: string }
  concepts: PoliticsConcept[]
  pairs: {
    pair_id: string
    concept_a: string
    concept_b: string
    label_en: string
    label_sv: string
  }[]
  phases: Phase[]
  similarity: {
    model: string
    act_version: string
    act_passages: number
    speech_paragraphs: number
    baseline_random_pairs: { n: number; mean: number; p95: number }
    top1_per_speech: { mean: number; median: number }
  }
}

export type MonthRow = {
  month: string
  speeches: number
  ai_speeches: number
  ai_act_speeches: number
  ai_share: number
  ai_share_rolling_3m: number
  speeches_rolling_3m: number
}

export type PartyYear = {
  party: string
  year: number
  speeches: number
  ai_speeches: number
  ai_share: number
  ai_act_speeches: number
}

export type ConceptRow = {
  party: string
  period: string
  period_kind: 'all' | 'phase' | 'year'
  concept_id: string
  ai_speeches: number
  speeches_with_concept: number
  share: number
}

export type FramingRow = {
  pair_id: string
  party: string
  period: string
  period_kind: 'all' | 'phase'
  ai_speeches: number
  speeches_a: number
  speeches_b: number
  speeches_both: number
  balance: number | null
}

export type Example = {
  concept_id: string
  speech_id: string
  paragraph: number
  text: string
  speech_date: string
  party: string | null
  speaker: string
  debate_title: string
  source_url: string
}

export type SimilarityRow = {
  article_number: string
  rank: number
  similarity: number
  above_chance: boolean
  act_passage_id: string
  act_passage_sv: string
  speech_id: string
  paragraph: number
  speech_paragraph: string
  speech_date: string
  party: string | null
  speaker: string
  debate_title: string
  speech_url: string
}

export type PoliticsData = {
  summary: PoliticsSummary
  monthly: MonthRow[]
  partyYear: PartyYear[]
  concepts: ConceptRow[]
  framing: FramingRow[]
  examples: Example[]
}
