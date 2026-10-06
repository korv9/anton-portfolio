/** The quality layer's published files (platform/publish/quality/export_quality.py). */

export type QualityStatus =
  'pass' | 'warning' | 'fail' | 'not_measured' | 'not_applicable'
export type ValidityStatus =
  | 'supported'
  | 'warning'
  | 'insufficient_evidence'
  | 'invalidated'
  | 'not_evaluated'

export type Dimension = {
  id: string
  label_en: string
  label_sv: string
  question_en: string
  question_sv: string
  iso_25012: string
  point_of_view: string
  note?: string
}

export type QualityProduct = {
  product_id: string
  project_id: string
  label_en: string
  label_sv: string
}

export type ProductDimension = {
  product_id: string
  dimension: string
  check_count: number
  measured_count: number
  pass_count: number
  warning_count: number
  fail_count: number
  not_measured_count: number
  not_applicable_count: number
}

export type QualitySummary = {
  dimensions: Dimension[]
  statuses: QualityStatus[]
  validity_kinds: {
    id: string
    label_en: string
    label_sv: string
    question_en: string
    question_sv: string
  }[]
  validity_statuses: ValidityStatus[]
  products: QualityProduct[]
  product_dimensions: ProductDimension[]
  run: {
    evaluated_at: string
    registry_sha256: string
    dbt: string
    checks: number
    analyses: number
    diagnostics: number
  }
  standards: Record<'iso_25012' | 'iso_25024' | 'iso_5259' | 'claim', string>
}

export type QualityCheck = {
  quality_check_id: string
  product_id: string
  project_id: string
  dataset_id: string
  dimension: string
  dimension_label: string
  description: string
  measure_name: string | null
  numerator_definition: string | null
  denominator_definition: string | null
  comparator: string | null
  threshold: number | null
  warn_at: number | null
  value: number | null
  numerator: number | null
  denominator: number | null
  sample_size: number | null
  reviewed_at: string | null
  status: QualityStatus
  severity: 'info' | 'warning' | 'error'
  method: string
  source: string
  gate: boolean
  details: Record<string, unknown>
  evaluated_at: string
}

export type Diagnostic = {
  diagnostic_id: string
  diagnostic: string
  experiment: string | null
  result: number | null
  details: Record<string, unknown>
  rule: Record<string, number | string> | null
  status: ValidityStatus
  interpretation: string
}

export type Analysis = {
  analysis_id: string
  product_id: string
  kind: string
  question_en: string
  question_sv: string | null
  target_construct: string
  proxy_measure: string
  analysis_status: ValidityStatus
  conclusion_en: string
  conclusion_sv: string | null
  source: string | null
  evaluated_at: string
  diagnostics: Diagnostic[]
  confounders?: {
    analysis: string
    confounder: string
    diagnostic: string
    effect: string
    mitigation: string
    remaining_risk: string
  }[]
  history?: {
    run_label: string
    experiment: string
    metric: string
    value: number
  }[]
}

export type QualityData = {
  summary: QualitySummary
  checks: QualityCheck[]
  validity: Analysis[]
}
