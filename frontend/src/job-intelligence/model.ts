import { jobInstant } from '../companies/model.ts'
export { jobInstant } from '../companies/model.ts'
import type { CompanyData, Job } from '../companies/model.ts'
import { safeSource } from '../compliance/model.ts'

export type Requirement = {
  label: string
  category: string
  strength: 'required' | 'preferred' | 'ambiguous'
  source_field: string
  line: number | null
  quote: string
}
export type JobDetail = {
  job_id: string
  document_hash: string
  source_url: string
  description_text: string
  text_origin: string
  contact_redactions: number
  application_url: string | null
  employment_type: string | null
  working_hours: string | null
  duration: string | null
  salary: string | null
  salary_type: string | null
  remote_evidence: string[]
  analysis: {
    version: string
    requirements: Requirement[]
    limitations: string
  }
}
export type WorkspaceContent = {
  schema_version: 1
  state: 'available'
  generated_at: string
  valid_until: string
  registry_hash: string
  selection: string
  jobs: JobDetail[]
}
export type CvMatchCapability = {
  state: 'disabled'
  reason: string
  processing: 'none'
}
export const cvMatch: CvMatchCapability = {
  state: 'disabled',
  processing: 'none',
  reason:
    'Public mode has no private candidate profile. No CV is uploaded, stored or sent externally.',
}

export function latestJobs(data: CompanyData, now = Date.now()) {
  return data.jobs
    .filter(
      (j) =>
        !j.application_deadline ||
        jobInstant(j.application_deadline, true) >= now,
    )
    .sort(
      (a, b) =>
        jobInstant(b.publication_date) - jobInstant(a.publication_date) ||
        (a.job_id < b.job_id ? -1 : a.job_id > b.job_id ? 1 : 0),
    )
    .slice(0, 50)
}
export function filterJobs(
  jobs: Job[],
  data: CompanyData,
  params: URLSearchParams,
) {
  const query = (params.get('q') || '').toLocaleLowerCase()
  return jobs.filter((j) => {
    const skills = j.normalized_skills || j.technologies
    return (
      `${j.title} ${j.employer_name || ''} ${j.location || ''} ${skills.join(' ')}`
        .toLocaleLowerCase()
        .includes(query) &&
      (!params.get('skill') || skills.includes(params.get('skill')!)) &&
      (!params.get('location') || j.location === params.get('location')) &&
      (!params.get('seniority') ||
        j.seniority?.includes(params.get('seniority')!)) &&
      (!params.get('company') ||
        data.links.some(
          (l) =>
            l.job_id === j.job_id &&
            l.company_id === params.get('company') &&
            l.match_status === 'verified',
        ))
    )
  })
}
export function parseWorkspace(
  value: unknown,
  data: CompanyData,
  { allowExpired = false, remaining = false } = {},
): WorkspaceContent {
  const w = value as WorkspaceContent
  if (
    w?.schema_version !== 1 ||
    w.state !== 'available' ||
    w.registry_hash !== data.registry_hash ||
    w.generated_at !== data.generated_at ||
    w.valid_until !== data.valid_until ||
    (!allowExpired && Date.parse(w.valid_until) <= Date.now()) ||
    !Array.isArray(w.jobs) ||
    w.jobs.length > (remaining ? data.jobs.length : 50)
  )
    throw new Error(
      'Full advertisement release is unavailable, expired or belongs to a different snapshot.',
    )
  const ids = new Set<string>()
  const ordered = [...data.jobs].sort(
    (a, b) =>
      jobInstant(b.publication_date) - jobInstant(a.publication_date) ||
      (a.job_id < b.job_id ? -1 : a.job_id > b.job_id ? 1 : 0),
  )
  const expected = (remaining ? ordered.slice(50) : ordered.slice(0, 50)).map(
    (j) => j.job_id,
  )
  if (JSON.stringify(expected) !== JSON.stringify(w.jobs.map((j) => j.job_id)))
    throw new Error(
      'Full advertisement partition does not match the source selection.',
    )
  for (const d of w.jobs) {
    const j = data.jobs.find((j) => j.job_id === d.job_id)
    if (
      !j ||
      ids.has(d.job_id) ||
      j.document_hash !== d.document_hash ||
      j.source_url !== d.source_url ||
      typeof d.description_text !== 'string' ||
      d.description_text.length > 500000 ||
      (d.application_url !== null && !safeSource(d.application_url)) ||
      !Array.isArray(d.analysis?.requirements) ||
      !Array.isArray(d.remote_evidence)
    )
      throw new Error('Full advertisement failed source validation.')
    ids.add(d.job_id)
    // Match Python str.splitlines(), including source records with bare CR/NEL.
    const lines = d.description_text.split(
      /\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/,
    )
    for (const r of d.analysis.requirements) {
      if (
        !['required', 'preferred', 'ambiguous'].includes(r.strength) ||
        typeof r.quote !== 'string' ||
        typeof r.label !== 'string' ||
        typeof r.category !== 'string' ||
        (r.source_field === 'description' &&
          (!r.line || !lines[r.line - 1]?.includes(r.quote)))
      )
        throw new Error('Requirements are missing their source evidence.')
    }
  }
  return w
}
