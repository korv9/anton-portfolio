/** The job-ad governance files (platform/publish/job_ai_governance) and the AI governance timeline. */

export type JobTerm = {
  term_id: string
  family: string
  label_en: string
  label_sv: string
  pattern: string
  case_sensitive: boolean
  description_en: string
}

export type JobsData = {
  summary: {
    terms: JobTerm[]
    archives: {
      archive: string
      source_url: string
      sha256: string
      ads: number
      counted_at: string
      dictionary_sha256: string
    }[]
    ads: number
    first_month: string
    last_month: string
    source: { label: string; url: string }
    method: string
  }
  monthly: {
    month: string
    term_id: string
    mention_count: number
    ads: number
    share: number
    share_rolling_3m: number
    share_change_yoy_pp: number | null
  }[]
  fields: {
    year: number
    field_id: string
    field: string
    term_id: string
    mention_count: number
    ads: number
    share: number
  }[]
  examples: {
    term_id: string
    publication_month: string
    headline: string
    occupation: string
    field: string
    matched: string
    context: string
    archive: string
  }[]
}

export type Signals = {
  columns: string[]
  series: {
    series_id: string
    domain: string
    label_en: string
    label_sv: string
    numerator_en: string
    numerator_sv: string
    denominator_en: string
    denominator_sv: string
    source_model: string
    route: string
    rows: [string, number, number, number, number][]
  }[]
  caveat_en: string
  caveat_sv: string
}
