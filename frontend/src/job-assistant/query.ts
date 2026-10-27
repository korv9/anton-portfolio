/**
 * The job board's search: one query read from and written to the address, the filter and sort
 * over the joined rows, the count per filter option, and the day arithmetic behind "2 days ago"
 * and "12 days left". Pure, so the unit tests run it without a browser.
 */
import {
  PIPELINE,
  type Ad,
  type MatchClass,
  type Records,
  type Row,
} from './model.ts'

export const MATCH_VIEWS = [
  'listed',
  'strong',
  'possible',
  'stretch',
  'outside',
  'sample',
] as const
export type MatchView = (typeof MATCH_VIEWS)[number]
export const PUBLISHED = ['1', '3', '7', '30'] as const
export const DEADLINE = ['7', '14', '30'] as const
export const LEVELS = ['junior', 'not_senior'] as const
export const SORTS = ['rank', 'newest', 'deadline'] as const

export type Query = {
  q: string
  match: MatchView
  /** A municipality, or 'remote' for ads that mention remote work. */
  place: string
  type: string
  role: string
  published: string
  deadline: string
  level: string
  sort: (typeof SORTS)[number]
}
/** The filters that narrow the list; each has a select and a removable chip. */
export const FACETS = [
  'match',
  'place',
  'type',
  'role',
  'published',
  'deadline',
  'level',
] as const
export type Facet = (typeof FACETS)[number]

export const DEFAULT_QUERY: Query = {
  q: '',
  match: 'listed',
  place: '',
  type: '',
  role: '',
  published: '',
  deadline: '',
  level: '',
  sort: 'rank',
}
const KEYS = Object.keys(DEFAULT_QUERY) as (keyof Query)[]
const CLOSED: Partial<Record<keyof Query, readonly string[]>> = {
  match: MATCH_VIEWS,
  published: PUBLISHED,
  deadline: DEADLINE,
  level: LEVELS,
  sort: SORTS,
}

/**
 * Unknown values fall back to the default, so an edited or old link still opens a list. A place,
 * type or role is checked against the loaded rows; before they load it is kept as written.
 */
export function parseQuery(params: URLSearchParams, all: Row[] = []): Query {
  const out = { ...DEFAULT_QUERY } as Record<keyof Query, string>
  for (const k of KEYS) {
    const v = params.get(k)?.trim()
    if (v && (!CLOSED[k] || CLOSED[k]!.includes(v))) out[k] = v
  }
  for (const f of ['place', 'type', 'role'] as const)
    if (
      out[f] &&
      all.length &&
      !all.some((r) => passes(r, f, out as Query, ''))
    )
      out[f] = DEFAULT_QUERY[f]
  return out as Query
}

/** The address for a query: defaults are left out; other parameters (ad, tab) are kept. */
export function queryParams(base: URLSearchParams, q: Query) {
  const params = new URLSearchParams(base)
  for (const k of KEYS) {
    if (q[k] && q[k] !== DEFAULT_QUERY[k]) params.set(k, q[k])
    else params.delete(k)
  }
  return params
}

export const isFiltered = (q: Query) =>
  Boolean(q.q.trim()) || FACETS.some((f) => q[f] !== DEFAULT_QUERY[f])

/** Whole days from a to b, both YYYY-MM-DD at the start; null when either is missing. */
export function daysBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  const day = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  const d = (day(b) - day(a)) / 86_400_000
  return Number.isNaN(d) ? null : Math.round(d)
}

/** Today in Stockholm, where JobTech's local times are written. */
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(now)

const SHOWN: Record<Exclude<MatchView, 'sample' | 'listed'>, MatchClass> = {
  strong: 'strong',
  possible: 'possible',
  stretch: 'stretch',
  outside: 'outside',
}

/** Whether a row passes one facet of the query. */
function passes(r: Row, f: Facet, q: Query, day: string): boolean {
  const v = q[f]
  if (f === 'match') {
    if (v === 'sample') return r.match.sample
    if (v === 'listed')
      return r.match.class === 'strong' || r.match.class === 'possible'
    return r.match.class === SHOWN[v as keyof typeof SHOWN]
  }
  if (!v) return true
  if (f === 'place')
    return v === 'remote' ? Boolean(r.match.remote) : r.ad.municipality === v
  if (f === 'type') return r.ad.employment_type === v
  if (f === 'role') return r.match.role === v
  if (f === 'published') {
    const age = daysBetween(r.ad.published, day)
    return age != null && age < Number(v)
  }
  if (f === 'deadline') {
    const left = daysBetween(day, r.ad.application_deadline)
    return left != null && left >= 0 && left <= Number(v)
  }
  // level: junior is the ad's own junior wording; not_senior has no senior title and states at
  // most two years, so an ad that names no years does not pass. Only detailed ads carry seniority.
  const s = r.match.seniority
  if (!s) return false
  return v === 'junior'
    ? Boolean(s.junior)
    : !s.title && s.years != null && s.years <= 2
}

/** Free text over the title, employer, occupation and the skills the ad names. */
export function haystack(r: Row) {
  return [
    r.ad.headline,
    r.ad.employer,
    r.ad.occupation ?? '',
    ...(r.match.skills ?? []).map((j) => j.skill),
  ]
    .join(' ')
    .toLocaleLowerCase()
}

function textPasses(r: Row, words: string[]) {
  if (!words.length) return true
  const text = haystack(r)
  return words.every((w) => text.includes(w))
}
const wordsOf = (q: Query) =>
  q.q.toLocaleLowerCase().split(/\s+/).filter(Boolean)

const BY: Record<Query['sort'], (a: Row, b: Row) => number> = {
  rank: (a, b) => a.match.rank - b.match.rank,
  newest: (a, b) =>
    (b.ad.published ?? '').localeCompare(a.ad.published ?? '') ||
    a.match.rank - b.match.rank,
  // Ads without a deadline go last; ties keep the match order.
  deadline: (a, b) =>
    (a.ad.application_deadline ?? '9999').localeCompare(
      b.ad.application_deadline ?? '9999',
    ) || a.match.rank - b.match.rank,
}

export function search(all: Row[], q: Query, day: string): Row[] {
  const words = wordsOf(q)
  return all
    .filter(
      (r) => textPasses(r, words) && FACETS.every((f) => passes(r, f, q, day)),
    )
    .sort(BY[q.sort])
}

/**
 * For each facet, how many rows each option would leave with every other filter kept: the
 * count shown next to an option is the number of ads choosing it gives.
 */
export function facetCounts(all: Row[], q: Query, day: string) {
  const words = wordsOf(q)
  const base = all.filter((r) => textPasses(r, words))
  const out = {} as Record<Facet, Map<string, number>>
  for (const f of FACETS) {
    const rest = base.filter((r) =>
      FACETS.every((g) => g === f || passes(r, g, q, day)),
    )
    const counts = new Map<string, number>()
    const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)
    for (const r of rest) {
      if (f === 'match') {
        for (const v of MATCH_VIEWS)
          if (passes(r, f, { ...q, match: v }, day)) add(v)
      } else if (f === 'place') {
        if (r.ad.municipality) add(r.ad.municipality)
        if (r.match.remote) add('remote')
      } else if (f === 'type') {
        if (r.ad.employment_type) add(r.ad.employment_type)
      } else if (f === 'role') {
        add(r.match.role)
      } else {
        const options = {
          published: PUBLISHED,
          deadline: DEADLINE,
          level: LEVELS,
        }[f]
        for (const v of options) if (passes(r, f, { ...q, [f]: v }, day)) add(v)
      }
    }
    out[f] = counts
  }
  return out
}

/**
 * The run is scheduled hourly, but GitHub has started it every 2.4 to 5.7 hours; past sla.fresh_within
 * of job_assistant in platform/pipeline.yml the board says the sync may have stopped.
 */
export const STALE_HOURS = 8

export function syncAge(generatedAt: string | undefined, now: Date) {
  const t = Date.parse(generatedAt ?? '')
  return Number.isNaN(t) ? null : (now.getTime() - t) / 3_600_000
}

/** The owner's reviews in pipeline order, newest change first; an ad gone from the file has no ad. */
export function pipelineColumns(ads: Ad[], records: Records) {
  const byId = new Map(ads.map((a) => [a.id, a]))
  return PIPELINE.map((status) => ({
    status,
    items: Object.entries(records.reviews)
      .filter(([, r]) => r.status === status)
      .map(([id, r]) => ({ id, ad: byId.get(id), updated: r.updated_at }))
      .sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? '')),
  }))
}
