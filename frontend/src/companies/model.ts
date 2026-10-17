import { safeSource } from '../compliance/model.ts'

export type Company = {
  company_id: string
  organization_number: string | null
  registered_legal_name: string
  country_code: string
  registry_authority: string
  registry_number: string
  primary_sni_code: string | null
  sni_version: string
  employee_size_class: string | null
  snapshot_date: string
  source_url: string
  document_hash: string
  last_verified_at: string
}
export type Job = {
  job_id: string
  title: string
  employer_name: string | null
  organization_number: string | null
  workplace_name: string | null
  location: string | null
  technologies: string[]
  normalized_skills?: string[]
  seniority?: string[]
  remote_evidence?: string[]
  publication_date: string
  application_deadline: string | null
  source_url: string
  document_hash: string
}
export type Link = {
  job_id: string
  company_id: string | null
  relationship_type: 'advertised_employer' | 'recruiter' | 'actual_employer'
  match_method: string
  match_status:
    'verified' | 'ambiguous' | 'unresolved' | 'review_required' | 'rejected'
  match_confidence: number
  verified_at: string | null
  job_payload_hash: string
  registry_hash: string
  evidence: {
    source_url?: string
    evidence_url?: string
    document_hash?: string
    source_locator?: string
  }[]
}
export type ContextFact = {
  company_id: string
  kind:
    | 'financial'
    | 'employees'
    | 'corporate_events'
    | 'contracts'
    | 'technology'
    | 'github'
    | 'stock'
  period: string
  label: string
  value: string
  unit: string | null
  source_url: string
  document_hash: string
  source_locator: string
  verified_at: string
  review_status: 'approved'
  entity_scope: 'legal_entity'
  issuer_id?: string
  country_code?: string
}
export type CompanyData = {
  schema_version: 1
  state: 'available'
  generated_at: string
  valid_until: string
  registry_hash: string
  coverage: {
    source_url: string
    license_url: string
    occupation_field_id: string
    occupation_field: string
    window_start: string
    window_end: string
    query_timezone: string
    coverage_status: string
    limitations: string[]
  }
  metrics: {
    total_active_it_ads: number
    verified_company_links: number
    match_coverage_percentage: number | null
    ambiguous_matches: number
    unresolved_matches: number
    review_required_matches: number
    rejected_matches: number
    companies_with_financial_data: number
    companies_with_reviewed_compliance_coverage: number | null
  }
  jobs: Job[]
  links: Link[]
  companies: Company[]
  context: ContextFact[]
  relationships: {
    company_id: string
    related_company_id: string
    relationship_type: string
    valid_from: string | null
    valid_to: string | null
    source_url: string
    document_hash: string
  }[]
}
const hash = /^[a-f0-9]{64}$/
function legalOrganizationNumber(n: string | null) {
  if (!n || !/^[2-9][0-9][2-9][0-9]{7}$/.test(n)) return false
  return (
    [...n].reduce((sum, c, i) => {
      const value = Number(c) * (i % 2 === 0 ? 2 : 1)
      return sum + Math.floor(value / 10) + (value % 10)
    }, 0) %
      10 ===
    0
  )
}
function require(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
export function parseCompanyData(
  value: unknown,
  { allowExpired = false } = {},
): CompanyData | null {
  const d = value as CompanyData
  require(d?.schema_version === 1, 'Unsupported company dataset')
  if ((value as { state: string }).state === 'unavailable') return null
  require(d.state === 'available' &&
    hash.test(d.registry_hash), 'Invalid company release')
  require(Number.isFinite(Date.parse(d.generated_at)) &&
    Date.parse(d.generated_at) <= Date.now() + 60000 &&
    Date.parse(d.valid_until) > Date.parse(d.generated_at) &&
    Date.parse(d.valid_until) - Date.parse(d.generated_at) <=
      2 * 86400000, 'Invalid observation period')
  require(allowExpired ||
    Date.parse(d.valid_until) >
      Date.now(), 'Current job snapshot has expired. Refresh is required.')
  require(Array.isArray(d.jobs) &&
    Array.isArray(d.links) &&
    Array.isArray(d.companies) &&
    Array.isArray(d.context), 'Missing dataset tables')
  const ids = new Set(d.companies.map((c) => c.company_id))
  require(ids.size === d.companies.length, 'Duplicate company')
  for (const c of d.companies) {
    require((c.country_code === 'SE'
      ? c.company_id === 'se:orgnr:' + c.organization_number &&
        legalOrganizationNumber(c.organization_number)
      : c.organization_number === null &&
        c.company_id ===
          c.country_code.toLowerCase() +
            ':' +
            encodeURIComponent(c.registry_authority) +
            ':' +
            encodeURIComponent(c.registry_number)) &&
      /^[A-Z]{2}$/.test(c.country_code) &&
      safeSource(c.source_url) &&
      hash.test(c.document_hash), 'Invalid company identity')
  }
  const jobs = new Map(d.jobs.map((j) => [j.job_id, j]))
  require(jobs.size === d.jobs.length, 'Duplicate advertisement')
  for (const j of d.jobs)
    require(safeSource(j.source_url) &&
      hash.test(j.document_hash) &&
      Array.isArray(j.technologies) &&
      Number.isFinite(
        Date.parse(j.publication_date),
      ), 'Invalid advertisement source')
  const seen = new Set<string>()
  for (const link of d.links) {
    const key = link.job_id + '/' + link.relationship_type
    require(!seen.has(key) &&
      jobs.has(link.job_id) &&
      link.job_payload_hash === jobs.get(link.job_id)?.document_hash &&
      link.registry_hash === d.registry_hash &&
      ['advertised_employer', 'recruiter', 'actual_employer'].includes(
        link.relationship_type,
      ) &&
      Number.isFinite(link.match_confidence) &&
      link.match_confidence >= 0 &&
      link.match_confidence <= 1, 'Invalid job relationship')
    seen.add(key)
    if (
      link.match_status === 'verified' &&
      link.match_method === 'exact_organization_number'
    ) {
      require(link.company_id ===
        'se:orgnr:' +
          jobs.get(link.job_id)
            ?.organization_number, 'Exact company match contradicts the original number')
    }
    if (link.match_status === 'verified')
      require(ids.has(link.company_id || '') &&
        link.verified_at &&
        Number.isFinite(Date.parse(link.verified_at)) &&
        link.evidence.length > 0, 'Verified relationship lacks evidence')
    else
      require([
        'ambiguous',
        'unresolved',
        'review_required',
        'rejected',
      ].includes(link.match_status) &&
        link.company_id === null &&
        link.verified_at ===
          null, 'Unverified relationship exposes company data')
    for (const e of link.evidence)
      require((link.match_status !== 'verified' ||
        (hash.test(e.document_hash || '') &&
          e.source_locator &&
          (e.source_url || e.evidence_url))) &&
        (!e.source_url || safeSource(e.source_url)) &&
        (!e.evidence_url ||
          safeSource(e.evidence_url)), 'Unsafe match evidence')
  }
  require(d.jobs.every((j) =>
    seen.has(j.job_id + '/advertised_employer'),
  ), 'Missing resolution state')
  const verified = d.links.filter(
    (l) =>
      l.relationship_type === 'advertised_employer' &&
      l.match_status === 'verified',
  ).length
  require(d.metrics.total_active_it_ads === jobs.size &&
    d.metrics.verified_company_links === verified &&
    d.metrics.match_coverage_percentage ===
      (jobs.size
        ? Math.round((10000 * verified) / jobs.size) / 100
        : null), 'Coverage does not reconcile')
  require(safeSource(d.coverage.source_url) &&
    safeSource(d.coverage.license_url), 'Invalid coverage source')
  for (const f of d.context)
    require(ids.has(f.company_id) &&
      f.entity_scope === 'legal_entity' &&
      f.review_status === 'approved' &&
      safeSource(f.source_url) &&
      hash.test(f.document_hash) &&
      f.source_locator &&
      typeof f.value === 'string' &&
      typeof f.label === 'string', 'Invalid company context')
  for (const r of d.relationships)
    require(ids.has(r.company_id) &&
      ids.has(r.related_company_id) &&
      safeSource(r.source_url) &&
      hash.test(r.document_hash), 'Invalid corporate relationship')
  return d
}
export function relatedJobs(data: CompanyData, id: string) {
  const jobs = new Set(
    data.links
      .filter((l) => l.company_id === id && l.match_status === 'verified')
      .map((l) => l.job_id),
  )
  return data.jobs.filter(
    (j) =>
      jobs.has(j.job_id) &&
      (!j.application_deadline ||
        jobInstant(j.application_deadline, true) >= Date.now()),
  )
}
export function hiringDaily(data: CompanyData, id: string) {
  const counts = new Map<string, number>()
  for (const j of relatedJobs(data, id)) {
    const day = j.publication_date.slice(0, 10)
    counts.set(day, (counts.get(day) || 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, ads]) => ({ day, ads }))
}
export const sizeLabels: Record<string, string> = {
  '1': '0',
  '2': '1–4',
  '3': '5–9',
  '4': '10–19',
  '5': '20–49',
  '6': '50–99',
  '7': '100–199',
  '8': '200–499',
  '9': '500–999',
  '10': '1,000–1,499',
  '11': '1,500–1,999',
  '12': '2,000–2,999',
  '13': '3,000–3,999',
  '14': '4,000–4,999',
  '15': '5,000–9,999',
  '16': '10,000+',
}

export function jobInstant(value: string, deadline = false) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    value += deadline ? 'T23:59:59' : 'T00:00:00'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
    const utc = Date.parse(value + 'Z')
    const wall = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    for (const offset of [2, 1]) {
      const candidate = utc - offset * 3600000
      if (
        wall.format(new Date(candidate)).replace(' ', 'T') ===
        value.slice(0, 19)
      )
        return candidate
    }
    return NaN
  }
  return Date.parse(value)
}
