/** Public projection only. Private review stores and raw documents never reach the browser. */
export type Company = {
  company_id: string
  organization_number: string | null
  registered_legal_name: string
  country_code: string
  registry_authority: string
  registry_number: string
  primary_sni_code: string | null
  employee_size_class: string | null
  snapshot_date: string
  source_url: string
  document_hash: string
  last_verified_at: string
  cohort_member: boolean
  employees_lower_bound: number | null
  employees_upper_bound: number | null
  financial_metadata: null
}
export type Source = {
  document_hash: string
  source_url: string
  authority: string
  decision_date: string
}
export type Decision = Source & {
  decision_id: string
  company_id: string
  case_number: string
  legal_entity: string
  original_outcome: string
  legal_status: string
  finality_status: string
  publication_date: string | null
  legal_basis: string[]
  last_verified_at: string
  reverify_by: string
  subsequent_decisions: (Source & { record_id: string; relation: string })[]
}
export type Amount = {
  amount_id: string
  amount: string
  currency: 'SEK' | 'EUR'
  amount_kind: 'original' | 'final_effective'
  decision_id: string
  document_hash: string
  source_url: string
}
export type Family = {
  origin_decision_id: string
  company_id: string
  case_id: string
  authority: string
  category: string
  decision_date: string
  legal_status: string
  administrative_sanctions: number
  gdpr_sanctions: number
  competition_sanctions: number
  under_appeal: boolean
  modified_decisions: number
  annulled_decisions: number
  final_amounts: Partial<Record<'SEK' | 'EUR', string>>
  decisions: Decision[]
  documents: Source[]
  amounts: Amount[]
}
export type Coverage = {
  authority: string
  period_start: string
  period_end: string
  period_role: string
  approved_decision_records: number
  reviewed_source_documents: number
  approved_record_field_completeness: number | null
  source_population_coverage_fraction: null
  search_execution_coverage_fraction: null
  coverage_status: string
}
export type Relationship = {
  company_id: string
  related_company_id: string
  relationship_type: string
  valid_from: string | null
  valid_to: string | null
  source_url: string
  document_hash: string
}
export type Payload = {
  schema_version: 1
  presentation_sha256: string
  context: {
    cohort_id: string
    cohort_size: number
    cohort_as_of_date: string
    membership_hash: string
    status_snapshot_at: string
    warnings: string[]
    selection_order: string[]
    selection_limitations: string[]
    filters: { date_from: string; date_to: string; group_as_of: string }
  }
  companies: Company[]
  relationships: Relationship[]
  families: Family[]
  coverage: Coverage[]
  evidence_valid_until: string | null
  methodology_markdown: string
}
export type Publication = {
  review_status: 'approved'
  reviewed_at: string
  valid_until: string
  payload_sha256: string
}
export type Release = { payload: Payload; publication: Publication }
export type Filters = {
  authority: string
  category: string
  status: string
  from: string
  to: string
  industry: string
  size: string
  scope: 'legal_entity' | 'corporate_group'
}
export type Summary = {
  id: string
  label: string
  members: Company[]
  families: Family[]
  sanctions: number | null
  gdpr: number | null
  competition: number | null
  appeals: number | null
  documents: Source[]
  finalAmounts: Partial<Record<'SEK' | 'EUR', string>> | null
}

const HEX = /^[a-f0-9]{64}$/
export const STATUSES = [
  'investigation',
  'alleged',
  'decided',
  'appealed',
  'final',
  'modified',
  'annulled',
  'unknown',
]
export function safeSource(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function finiteCount(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
export async function parseRelease(
  value: unknown,
  time = Date.now(),
): Promise<Release | null> {
  assert(value && typeof value === 'object', 'Invalid release')
  const envelope = value as {
    schema_version?: number
    state?: string
    publication?: Publication
    payload_json?: string
  }
  assert(envelope.schema_version === 1, 'Unsupported release')
  if (envelope.state === 'unavailable') return null
  const pub = envelope.publication
  assert(
    envelope.state === 'approved' && pub?.review_status === 'approved',
    'Final review is missing',
  )
  assert(
    Number.isFinite(Date.parse(pub.reviewed_at)) &&
      Date.parse(pub.reviewed_at) <= time &&
      Date.parse(pub.valid_until) > time,
    'Release review has expired or is invalid',
  )
  assert(
    typeof envelope.payload_json === 'string' && HEX.test(pub.payload_sha256),
    'Invalid release fingerprint',
  )
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(envelope.payload_json),
      ),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('')
  assert(hash === pub.payload_sha256, 'Release integrity check failed')
  const data = JSON.parse(envelope.payload_json) as Payload
  assert(
    data.schema_version === 1 &&
      HEX.test(data.presentation_sha256) &&
      data.context?.cohort_size === 50 &&
      HEX.test(data.context.membership_hash),
    'Verified 50-company cohort required',
  )
  assert(
    Array.isArray(data.companies) &&
      Array.isArray(data.families) &&
      Array.isArray(data.coverage) &&
      Array.isArray(data.relationships),
    'Invalid datasets',
  )
  assert(
    typeof data.methodology_markdown === 'string' &&
      Array.isArray(data.context.warnings),
    'Methodology required',
  )
  const companies = new Map(data.companies.map((c) => [c.company_id, c]))
  assert(
    companies.size === data.companies.length &&
      data.companies.filter((c) => c.cohort_member).length === 50,
    'Cohort membership mismatch',
  )
  for (const c of data.companies) {
    assert(
      typeof c.registered_legal_name === 'string' &&
        c.registered_legal_name.length > 0 &&
        safeSource(c.source_url) &&
        HEX.test(c.document_hash),
      'Invalid company provenance',
    )
  }
  const ids = new Set<string>()
  for (const f of data.families) {
    assert(
      !ids.has(f.origin_decision_id) &&
        companies.get(f.company_id)?.cohort_member &&
        STATUSES.includes(f.legal_status),
      'Invalid case identity or status',
    )
    ids.add(f.origin_decision_id)
    assert(
      [
        f.administrative_sanctions,
        f.gdpr_sanctions,
        f.competition_sanctions,
        f.modified_decisions,
        f.annulled_decisions,
      ].every(finiteCount),
      'Invalid metric',
    )
    assert(
      !['alleged', 'investigation', 'unknown', 'annulled', 'modified'].includes(
        f.legal_status,
      ) || f.administrative_sanctions === 0,
      'Unconfirmed case counted as sanction',
    )
    assert(
      Array.isArray(f.decisions) &&
        f.decisions.length > 0 &&
        Array.isArray(f.documents) &&
        Array.isArray(f.amounts),
      'Invalid evidence',
    )
    for (const d of [...f.decisions, ...f.documents])
      assert(
        safeSource(d.source_url) && HEX.test(d.document_hash),
        'Unsafe evidence reference',
      )
    for (const d of f.decisions)
      assert(
        d.company_id === f.company_id &&
          Date.parse(d.reverify_by) >= Date.parse(pub.valid_until),
        'Attribution or freshness mismatch',
      )
    for (const [currency, amount] of Object.entries(f.final_amounts))
      assert(
        ['SEK', 'EUR'].includes(currency) && /^\d+\.\d{2}$/.test(amount!),
        'Invalid native-currency total',
      )
    for (const a of f.amounts)
      assert(
        ['SEK', 'EUR'].includes(a.currency) &&
          /^\d+\.\d{2}$/.test(a.amount) &&
          ['original', 'final_effective'].includes(a.amount_kind),
        'Invalid amount',
      )
  }
  for (const r of data.relationships)
    assert(
      companies.has(r.company_id) &&
        companies.has(r.related_company_id) &&
        safeSource(r.source_url),
      'Invalid relationship',
    )
  assert(
    !data.evidence_valid_until ||
      Date.parse(data.evidence_valid_until) >= Date.parse(pub.valid_until),
    'Evidence verification expired',
  )
  return { payload: data, publication: pub }
}

export function filtersOf(params: URLSearchParams, data: Payload): Filters {
  const defaults = data.context.filters
  return {
    authority: params.get('authority') || '',
    category: params.get('category') || '',
    status: params.get('status') || '',
    from: params.get('from') || defaults.date_from,
    to: params.get('to') || defaults.date_to,
    industry: params.get('industry') || '',
    size: params.get('size') || '',
    scope:
      params.get('scope') === 'corporate_group'
        ? 'corporate_group'
        : 'legal_entity',
  }
}
export function filterError(f: Filters, data: Payload) {
  const validDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  if (
    !validDate(f.from) ||
    !validDate(f.to) ||
    f.from > f.to ||
    f.from < data.context.filters.date_from ||
    f.to > data.context.filters.date_to
  )
    return 'Choose a valid date range within the published analysis window.'
  if (f.status && !STATUSES.includes(f.status))
    return 'Choose a supported legal status.'
  return null
}
export function selectedFamilies(data: Payload, f: Filters) {
  if (filterError(f, data)) return []
  const ids = new Set(
    data.companies
      .filter(
        (c) =>
          c.cohort_member &&
          (!f.industry || c.primary_sni_code === f.industry) &&
          (!f.size || c.employee_size_class === f.size),
      )
      .map((c) => c.company_id),
  )
  return data.families.filter(
    (c) =>
      ids.has(c.company_id) &&
      c.decision_date >= f.from &&
      c.decision_date <= f.to &&
      (!f.authority || c.authority === f.authority) &&
      (!f.category || c.category === f.category) &&
      (!f.status || c.legal_status === f.status),
  )
}
export function groupRoot(id: string, data: Payload): string {
  const when = data.context.filters.group_as_of
  const seen = new Set<string>()
  while (true) {
    if (seen.has(id))
      throw new Error('Cyclic group relationship; use legal entities')
    seen.add(id)
    const candidates = data.relationships.filter(
      (r) => r.company_id === id && r.relationship_type === 'subsidiary_of',
    )
    if (candidates.some((r) => !r.valid_from))
      throw new Error('Undated group relationship; use legal entities')
    const active = candidates.filter(
      (r) => r.valid_from! <= when && (!r.valid_to || when < r.valid_to),
    )
    if (active.length > 1)
      throw new Error('Ambiguous group relationship; use legal entities')
    if (!active.length) return id
    id = active[0].related_company_id
  }
}
export function independentRankingScope(filters: Filters) {
  return (
    filters.authority === 'Integritetsskyddsmyndigheten' &&
    (!filters.category || filters.category === 'data_protection')
  )
}
export function cents(amount: string) {
  return BigInt(amount.replace('.', ''))
}
export function decimal(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`
}
export function uniqueDocuments(families: Family[]): Source[] {
  return [
    ...new Map(
      families.flatMap((f) => f.documents).map((d) => [d.document_hash, d]),
    ).values(),
  ]
}
export function summaries(data: Payload, filters: Filters): Summary[] {
  const families = selectedFamilies(data, filters)
  const groups = new Map<string, Company[]>()
  for (const company of data.companies.filter(
    (c) =>
      c.cohort_member &&
      (!filters.industry || filters.industry === c.primary_sni_code) &&
      (!filters.size || filters.size === c.employee_size_class),
  )) {
    const id =
      filters.scope === 'corporate_group'
        ? groupRoot(company.company_id, data)
        : company.company_id
    groups.set(id, [...(groups.get(id) || []), company])
  }
  return [...groups].map(([id, members]) => {
    const memberIds = new Set(members.map((c) => c.company_id))
    const fs = families.filter((f) => memberIds.has(f.company_id))
    const totals: Partial<Record<'SEK' | 'EUR', bigint>> = {}
    for (const f of fs)
      for (const currency of ['SEK', 'EUR'] as const) {
        if (f.final_amounts[currency] != null)
          totals[currency] =
            (totals[currency] || 0n) + cents(f.final_amounts[currency]!)
      }
    return {
      id,
      label: data.companies.find((c) => c.company_id === id)!
        .registered_legal_name,
      members,
      families: fs,
      sanctions: fs.length
        ? fs.reduce((n, f) => n + f.administrative_sanctions, 0)
        : null,
      gdpr: fs.length ? fs.reduce((n, f) => n + f.gdpr_sanctions, 0) : null,
      competition: fs.some((f) => f.category === 'competition')
        ? fs.reduce((n, f) => n + f.competition_sanctions, 0)
        : null,
      appeals: fs.length
        ? new Set(fs.filter((f) => f.under_appeal).map((f) => f.case_id)).size
        : null,
      documents: uniqueDocuments(fs),
      finalAmounts: fs.length
        ? Object.fromEntries(
            Object.entries(totals).map(([c, v]) => [c, decimal(v!)]),
          )
        : null,
    }
  })
}
export function orderSummaries(
  rows: Summary[],
  sort: string,
  currency: 'SEK' | 'EUR',
  ascending = false,
) {
  const value = (r: Summary) =>
    sort === 'money'
      ? r.finalAmounts?.[currency] != null
        ? cents(r.finalAmounts[currency]!)
        : null
      : r.sanctions == null
        ? null
        : BigInt(r.sanctions)
  return [...rows].sort((a, b) => {
    if (sort === 'name')
      return a.label.localeCompare(b.label, 'sv') * (ascending ? 1 : -1)
    const av = value(a),
      bv = value(b)
    if (av == null || bv == null)
      return av == null && bv == null
        ? a.label.localeCompare(b.label, 'sv')
        : av == null
          ? 1
          : -1
    return (
      (av === bv ? 0 : av > bv ? -1 : 1) * (ascending ? -1 : 1) ||
      a.label.localeCompare(b.label, 'sv')
    )
  })
}
export function observedRank(
  rows: Summary[],
  row: Summary,
  sort: string,
  currency: 'SEK' | 'EUR',
) {
  if (sort === 'name') return null
  const metric = (r: Summary) =>
    sort === 'money'
      ? r.finalAmounts?.[currency] != null
        ? cents(r.finalAmounts[currency]!)
        : null
      : r.sanctions == null
        ? null
        : BigInt(r.sanctions)
  const values = rows.map(metric).filter((v) => v != null)
  const value = metric(row)
  if (value == null || values.length < 2) return null
  return new Set(values.filter((v) => v! > value).map(String)).size + 1
}
