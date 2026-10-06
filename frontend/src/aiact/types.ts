/** The EU AI Act Observatory's delivered data (platform/publish/eu_ai_act/export_ai_act.py). */

export type Bi = { en: string; sv: string }

export type Summary = {
  title: string
  counts: Record<string, number>
  current_version: Version
  original_version: Version
  amended_by: Version[]
  latest_retrieval: string | null
  sources: { id: string; label: string; url: string }[]
}

export type Version = {
  celex: string
  published_at: string
  title: string
  source_url: string
}

export type Article = {
  article_id: string
  article_number: string
  position: number
  title_en: string
  title_sv: string
  chapter: string
  section: string | null
  char_count: number
  change_type: 'inserted' | 'amended' | 'unchanged' | 'text_differs'
  amended_by: string[]
  application_rule_id: string
  applies_from: string
  applies_from_second: string | null
  applies_partially: boolean
  application_quote: string
  application_note_en: string
  application_note_sv: string
  source_url: string
  actors: string[]
  refers_to: string[]
  guidance: string[]
}

export type Chapter = {
  chapter: string
  chapter_title_en: string
  chapter_title_sv: string
  section: string | null
  section_title_en: string | null
  section_title_sv: string | null
}

export type Actor = {
  actor_id: string
  official_term: string
  label_en: string
  label_sv: string
  actor_group: 'operator' | 'authority' | 'body'
  definition_point: string
  defined_term: string
  definition: string
  definition_note: string | null
  articles_mentioning: number
  articles_with_duty_sentences: number
}

export type RiskClass = {
  risk_class_id: string
  label_en: string
  label_sv: string
  legal_basis: string
  source_article: string
  source_quote: string
  common_name_en: string
  description_en: string
  description_sv: string
}

export type Obligation = {
  obligation_id: string
  actor_id: string
  requirement_type: string
  risk_class_id: string
  article_number: string
  paragraph: string | null
  article_title_en: string
  article_title_sv: string
  source_quote: string
  summary_en: string
  summary_sv: string
  applies_from: string
  applies_from_second: string | null
  applies_partially: boolean
  application_quote: string
  article_change_type: string
  source_url: string
}

export type Milestone = {
  milestone_id: string
  date: string
  kind: 'entry_into_force' | 'application' | 'deadline' | 'document'
  title_en: string
  title_sv: string
  description_en: string
  description_sv: string
  affected_articles: string[]
  affected_actors: string[]
  source_article: string | null
  source_quote: string | null
  source_url: string
  origin: string
}

export type Change = {
  change_id: string
  change_date: string
  change_kind:
    | 'amendment'
    | 'corrigendum'
    | 'consolidated_version'
    | 'proposal'
    | 'implementing_act'
    | 'commission_report'
    | 'guidance'
    | 'provision'
  document_id: string
  document_title: string
  article_number: string | null
  provision_id: string | null
  provision_title: string | null
  change_type: string | null
  affected_actors: string[]
  source_url: string
  basis: string
}

export type Document = {
  document_id: string
  celex: string
  document_type: string
  title: string | null
  published_at: string
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
  text_languages: string | null
  source_url: string
}

export type Guidance = {
  guidance_id: string
  kind: string
  title: string
  published_at: string | null
  source_url: string
  articles: string[]
  last_fetched_at: string
}

export type Answer = 'yes' | 'no' | 'unsure'

export type NavigatorEffect = {
  roles?: string[]
  risk_classes?: string[]
  obligations?: string[]
  obligations_by_role?: Record<string, string[]>
  note?: Bi
}

export type NavigatorQuestion = {
  id: string
  text: Bi
  articles: string[]
  show_if?: Record<string, Answer>
  show_if_any?: Record<string, Answer>
  effects: Partial<Record<Answer, NavigatorEffect>>
}

export type Navigator = {
  disclaimer: Bi
  questions: NavigatorQuestion[]
}

export type AiActData = {
  summary: Summary
  articles: Article[]
  chapters: Chapter[]
  actors: Actor[]
  riskClasses: RiskClass[]
  obligations: Obligation[]
  timeline: Milestone[]
  changes: Change[]
  documents: Document[]
  guidance: Guidance[]
  navigator: Navigator
}
