/** Types and pure logic of the job assistant: the joined rows and the personal statuses. */
export type MatchClass = 'strong' | 'possible' | 'stretch' | 'outside'
export const CLASSES: MatchClass[] = [
  'strong',
  'possible',
  'stretch',
  'outside',
]
/** The reader's own marks on an ad: the only personal functions on the board. */
export const MINE = ['saved', 'applied', 'closed'] as const
export type Mine = (typeof MINE)[number]
/** Statuses the owner store (D1, worker/jobs.ts) accepts; older ones are read into a mark. */
export type Status =
  | 'new'
  | 'review'
  | 'interesting'
  | 'pass'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'
/** A mark as the owner store writes it; none is written as 'new'. */
export const TO_STORE: Record<Mine, Status> = {
  saved: 'interesting',
  applied: 'applied',
  closed: 'closed',
}
/** A stored status as a mark: interview and offer still count as applied, a pass or no as closed. */
export const FROM_STORE: Record<Status, Mine | undefined> = {
  new: undefined,
  review: undefined,
  interesting: 'saved',
  applied: 'applied',
  interview: 'applied',
  offer: 'applied',
  pass: 'closed',
  rejected: 'closed',
  closed: 'closed',
}

export type Ad = {
  id: string
  headline: string
  employer: string
  municipality: string | null
  region: string | null
  occupation: string | null
  employment_type: string | null
  working_hours: string | null
  published: string | null
  changed: string | null
  first_seen: string
  application_deadline: string | null
  removed_at: string | null
  duplicate_of: string | null
  source_url: string
  application_url: string | null
  expired: boolean
}
/** Where a CV quote comes from (platform/job_assistant); absent in files before it was added. */
export const SOURCES = [
  'employment',
  'internship',
  'education',
  'project',
  'skills_list',
  'summary',
] as const
export type Source = (typeof SOURCES)[number]
export type Quote = {
  quote: string
  source?: Source
  line?: number | null
  field?: string
  ref?: string
  level?: string
}
export type Judgement = {
  skill: string
  strength: 'required' | 'preferred' | 'ambiguous'
  cv_level: 'practical' | 'education_or_project' | 'listed' | 'interest' | null
  ad_quotes: Quote[]
  cv_quotes: Quote[]
}
export type Match = {
  id: string
  rank: number
  class: MatchClass
  role: string
  role_from_title: boolean
  reasons: string[]
  similarity: number | null
  sample: boolean
  detailed: boolean
  gaps?: string[]
  uncertain?: string[]
  remote?: string | null
  seniority?: {
    title: string | null
    years: number | null
    junior: string | null
  }
  explanation?: string | null
  explanation_model?: string | null
  skills?: Judgement[]
  checks?: { kind: string; label: string; quote: string; line: number | null }[]
}
export type Profile = {
  profile_version: number
  cv_sha256: string
  approved_at: string
  matched_at: string
  neurons_after: number | null
}
export type Delivered = {
  ads: {
    generated_at: string
    fetched_until: string | null
    counts: { current: number; removed: number; duplicates: number }
    runs: { day: string; runs: number; runs_ok: number; runs_failed: number }[]
    ads: Ad[]
  }
  matches: {
    profile: Profile | null
    /** rank.py's note on the profile route (platform/job_assistant/export_matches.py). */
    status?: { skipped?: RouteNote; kept?: RouteNote }
    matches: Match[]
  }
  texts: {
    texts: Record<string, { description: string; contact_redactions: number }>
  }
  demand: {
    skills: {
      skill: string
      ads_required: number
      ads_preferred: number
      ads_naming: number
      share_naming: number
      cv_level: string | null
    }[]
  }
  /** The optional files that failed to load. */
  missing: Optional[]
}
/** A released file other than ads.json that could not be read; the page goes on without it. */
export type Optional = 'matches' | 'texts' | 'demand'
export type Review = { status: Status; note: string; updated_at?: string }
export type Records = {
  reviews: Record<string, Review>
  available: boolean
  /** Why the records could not be read with a token: refused, no storage (503), or unreachable. */
  problem?: 'token' | 'storage' | 'offline'
}

/** What the owner sees when the records could not be read, as [English, Swedish]. */
export function recordsNote(p: Records['problem']): [string, string] {
  if (p === 'token')
    return [
      'The owner token was not accepted, so statuses are kept on this device only.',
      'Ägartoken godtogs inte, så status sparas bara på den här enheten.',
    ]
  if (p === 'storage')
    return [
      'The owner store is not set up yet, so statuses are kept on this device only.',
      'Ägarlagringen är inte uppsatt än, så status sparas bara på den här enheten.',
    ]
  return [
    'The owner store could not be reached just now, so statuses are kept on this device.',
    'Ägarlagringen gick inte att nå just nu, så status sparas på den här enheten.',
  ]
}

/** A link from the source data, only when it is an absolute https URL; anything else gets no link. */
export function https(url: string | null | undefined) {
  try {
    return url && new URL(url).protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

export type Row = { ad: Ad; match?: Match; mine?: Mine }

/**
 * The board's rows: every open ad (not removed, not expired, not a duplicate) with its match
 * when there is one, and any other ad the reader has marked, so a saved ad stays findable.
 */
export function rows(d: Delivered, mine: Record<string, Mine>): Row[] {
  const matches = new Map(d.matches.matches.map((m) => [m.id, m]))
  return d.ads.ads.flatMap((ad) =>
    (!ad.removed_at && !ad.expired && !ad.duplicate_of) || mine[ad.id]
      ? [{ ad, match: matches.get(ad.id), mine: mine[ad.id] }]
      : [],
  )
}

export const ROLE_NAMES: Record<string, [string, string]> = {
  data_engineering: ['Data Engineering', 'Data Engineering'],
  analytics_engineering: ['Analytics Engineering', 'Analytics Engineering'],
  applied_ai: ['Applied AI', 'Tillämpad AI'],
  ml_engineering: ['ML Engineering', 'ML Engineering'],
  python_backend: ['Python Backend', 'Python-backend'],
  bi: ['BI', 'BI'],
  data_analysis: ['Data Analysis', 'Dataanalys'],
  fullstack: ['Full stack', 'Fullstack'],
  frontend: ['Frontend', 'Frontend'],
  other: ['Other', 'Annat'],
}

/** Why rank.py matched nothing or kept the last matches: the reason, the HTTP status (null when unreachable), when. */
export type RouteNote = { reason: string; status: number | null; at: string }

const utc = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 16)} UTC`

/**
 * What the board says when nothing is matched, as [English, Swedish]. Only a 200 without an
 * approved profile means the profile is still to be approved; any other reason reads as a calm
 * pause. The HTTP status stays in matches.json, not in public copy.
 */
export function unmatchedNote(n?: RouteNote): [string, string] {
  if (n?.status === 200)
    return [
      'Matching starts when the CV profile is approved.',
      'Matchningen börjar när cv-profilen är godkänd.',
    ]
  return [
    'Matching against my CV is paused for now.',
    'Matchningen mot mitt cv är pausad just nu.',
  ]
}

/** The notice when the last matches stand because the profile route could not be read. */
export function keptNote(n: RouteNote): [string, string] {
  const why = n.status == null ? 'could not be reached' : `answered ${n.status}`
  const varfor = n.status == null ? 'gick inte att nå' : `svarade ${n.status}`
  return [
    `The profile route ${why} at ${utc(n.at)}, so these are the matches of the last run that read it.`,
    `Profilen ${varfor} ${utc(n.at)}, så det här är matchningarna från den senaste körningen som läste den.`,
  ]
}
