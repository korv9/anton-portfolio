/** Aggregate processing progress only; it cannot supply a company finding or sanction metric. */
export type Progress = {
  schema_version: 1
  state: 'awaiting_human_review'
  observed_at: string
  cohort: {
    cohort_id: string
    selected_count: 50
    as_of_date: string
    eligible_population_count: number
    membership_hash: string
    selection_order: string[]
    selection_scope: 'private_research' | 'reuse_reviewed'
    source_reuse_status: 'reviewed' | 'not_reviewed_for_publication'
  }
  sources: Record<
    string,
    {
      authority: string
      source_url: string
      status: string
      verified_at: string | null
      observed_resources: number
      observed_documents: number
      coverage_fraction: null
    }
  >
  review: {
    candidate_records: number
    evidence_complete: number
    publication_eligible: number
    human_review_actions: number
  }
  approved_gold_records: number
}
function keys(value: object, expected: string[]) {
  const actual = Object.keys(value).sort()
  return JSON.stringify(actual) === JSON.stringify(expected.sort())
}
const sources: Record<string, [string, string]> = {
  imy: [
    'Integritetsskyddsmyndigheten',
    'https://www.imy.se/om-oss/beslut-publikationer-och-remisser/beslut-om-sanktionsavgift/',
  ],
  kkv: [
    'Konkurrensverket',
    'https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista',
  ],
}
export function parseProgress(value: unknown): Progress {
  const p = value as Progress
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0
  const time = (v: string) =>
    /(?:Z|\+00:00)$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    Date.parse(v) <= Date.now()
  if (
    !p ||
    p.schema_version !== 1 ||
    p.state !== 'awaiting_human_review' ||
    !keys(p, [
      'schema_version',
      'state',
      'observed_at',
      'cohort',
      'sources',
      'review',
      'approved_gold_records',
    ]) ||
    !time(p.observed_at)
  )
    throw new Error('Invalid processing progress')
  const c = p.cohort
  if (
    !c ||
    !keys(c, [
      'cohort_id',
      'selected_count',
      'as_of_date',
      'eligible_population_count',
      'membership_hash',
      'selection_order',
      'selection_scope',
      'source_reuse_status',
    ]) ||
    c.selected_count !== 50 ||
    typeof c.cohort_id !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(c.cohort_id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(c.as_of_date) ||
    !Number.isFinite(Date.parse(c.as_of_date)) ||
    new Date(c.as_of_date).toISOString().slice(0, 10) !== c.as_of_date ||
    !/^[a-f0-9]{64}$/.test(c.membership_hash) ||
    !count(c.eligible_population_count) ||
    c.eligible_population_count < 50 ||
    JSON.stringify(c.selection_order) !==
      JSON.stringify([
        'employee_size_class_order descending',
        'organization_number ascending',
      ]) ||
    !['private_research', 'reuse_reviewed'].includes(c.selection_scope) ||
    !['reviewed', 'not_reviewed_for_publication'].includes(
      c.source_reuse_status,
    )
  )
    throw new Error('Invalid progress cohort')
  if (
    !p.review ||
    !keys(p.review, [
      'candidate_records',
      'evidence_complete',
      'publication_eligible',
      'human_review_actions',
    ]) ||
    !Object.values(p.review).every(count) ||
    !count(p.approved_gold_records) ||
    p.review.evidence_complete > p.review.candidate_records ||
    p.review.publication_eligible > p.review.evidence_complete ||
    p.approved_gold_records > p.review.publication_eligible ||
    !p.sources ||
    !keys(p.sources, ['imy', 'kkv'])
  )
    throw new Error('Invalid progress counts')
  for (const [id, s] of Object.entries(p.sources)) {
    if (
      !sources[id] ||
      !keys(s, [
        'authority',
        'source_url',
        'status',
        'verified_at',
        'observed_resources',
        'observed_documents',
        'coverage_fraction',
      ]) ||
      s.authority !== sources[id][0] ||
      s.source_url !== sources[id][1] ||
      s.coverage_fraction !== null ||
      ![
        'not_collected',
        'bounded_partial',
        'blocked_access',
        'partial_failures',
        'published_list_traversed',
        'manifest_batch_completed',
      ].includes(s.status) ||
      !count(s.observed_resources) ||
      !count(s.observed_documents) ||
      s.observed_documents > s.observed_resources ||
      (s.verified_at !== null && !time(s.verified_at))
    )
      throw new Error('Invalid progress source')
  }
  return p
}
