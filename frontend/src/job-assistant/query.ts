/**
 * The job board's search: one query read from and written to the address, the list tabs and
 * filters over the joined rows, the count per tab and option, and the day arithmetic behind
 * "12 days left". Pure, so the unit tests run it without a browser.
 */
import { CLASSES, type Row } from './model.ts'

/** The list tabs: good fit (strong and possible), the reader's three marks, and every open ad. */
export const LISTS = ['good', 'saved', 'applied', 'closed', 'all'] as const
export type List = (typeof LISTS)[number]
export const LEVELS = ['junior', 'not_senior'] as const

export type Query = {
  q: string
  list: List
  /** A municipality, or 'remote' for ads that mention remote work. */
  place: string
  role: string
  level: string
}
/** The filters that narrow a list, each a select in the Filters disclosure. */
export const FACETS = ['place', 'role', 'level'] as const
export type Facet = (typeof FACETS)[number]

export const DEFAULT_QUERY: Query = {
  q: '',
  list: 'good',
  place: '',
  role: '',
  level: '',
}
const KEYS = Object.keys(DEFAULT_QUERY) as (keyof Query)[]
const CLOSED: Partial<Record<keyof Query, readonly string[]>> = {
  list: LISTS,
  level: LEVELS,
}

/**
 * Unknown values fall back to the default, so an edited or old link still opens a list. A place
 * or role is checked against the loaded rows; before they load it is kept as written. `list` is
 * the default tab: good fit with a profile, every ad without one.
 */
export function parseQuery(
  params: URLSearchParams,
  all: Row[] = [],
  list: List = DEFAULT_QUERY.list,
): Query {
  const out = { ...DEFAULT_QUERY, list } as Record<keyof Query, string>
  for (const k of KEYS) {
    const v = params.get(k)?.trim()
    if (v && (!CLOSED[k] || CLOSED[k]!.includes(v))) out[k] = v
  }
  for (const f of ['place', 'role'] as const)
    if (out[f] && all.length && !all.some((r) => passes(r, f, out as Query)))
      out[f] = DEFAULT_QUERY[f]
  return out as Query
}

/** The address for a query: defaults are left out; other parameters (ad, tab) are kept. */
export function queryParams(
  base: URLSearchParams,
  q: Query,
  list: List = DEFAULT_QUERY.list,
) {
  const params = new URLSearchParams(base)
  const defaults = { ...DEFAULT_QUERY, list }
  for (const k of KEYS) {
    if (q[k] && q[k] !== defaults[k]) params.set(k, q[k])
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

/** Whether a row is in a list tab. */
export function inList(r: Row, list: List) {
  if (list === 'all') return true
  if (list === 'good')
    return r.match?.class === 'strong' || r.match?.class === 'possible'
  return r.mine === list
}

/** Whether a row passes one filter of the query. */
function passes(r: Row, f: Facet, q: Query): boolean {
  const v = q[f]
  if (!v) return true
  if (f === 'place')
    return v === 'remote' ? Boolean(r.match?.remote) : r.ad.municipality === v
  if (f === 'role') return r.match?.role === v
  // level: junior is the ad's own junior wording; not_senior has no senior title and states at
  // most two years, so an ad that names no years does not pass. Only detailed ads carry seniority.
  const s = r.match?.seniority
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
    ...(r.match?.skills ?? []).map((j) => j.skill),
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

// Fit first (strong, possible, stretch, outside, unmatched), then the nearest deadline (none
// last), then the match rank.
const fit = (r: Row) => (r.match ? CLASSES.indexOf(r.match.class) : 9)
const byFit = (a: Row, b: Row) =>
  fit(a) - fit(b) ||
  (a.ad.application_deadline ?? '9999').localeCompare(
    b.ad.application_deadline ?? '9999',
  ) ||
  (a.match?.rank ?? 1e9) - (b.match?.rank ?? 1e9)

/** The rows that pass the text and the filters, in any list. */
function filtered(all: Row[], q: Query, except?: Facet) {
  const words = wordsOf(q)
  return all.filter(
    (r) =>
      textPasses(r, words) &&
      FACETS.every((f) => f === except || passes(r, f, q)),
  )
}

export function search(all: Row[], q: Query): Row[] {
  return filtered(all, q)
    .filter((r) => inList(r, q.list))
    .sort(byFit)
}

/** How many rows each list tab holds with the search and filters kept. */
export function listCounts(all: Row[], q: Query) {
  const rest = filtered(all, q)
  return Object.fromEntries(
    LISTS.map((l) => [l, rest.filter((r) => inList(r, l)).length]),
  ) as Record<List, number>
}

/**
 * For each filter, how many rows of the current list each option would leave with every other
 * filter kept: the count shown next to an option is the number of ads choosing it gives.
 */
export function facetCounts(all: Row[], q: Query) {
  const out = {} as Record<Facet, Map<string, number>>
  for (const f of FACETS) {
    const counts = new Map<string, number>()
    const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)
    for (const r of filtered(all, q, f)) {
      if (!inList(r, q.list)) continue
      if (f === 'place') {
        if (r.ad.municipality) add(r.ad.municipality)
        if (r.match?.remote) add('remote')
      } else if (f === 'role') {
        if (r.match) add(r.match.role)
      } else {
        for (const v of LEVELS) if (passes(r, f, { ...q, level: v })) add(v)
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

/**
 * The lead: the first lines up to about 250 characters, never past the first blank line (ads
 * often run their whole text as one paragraph). The rest is everything after it.
 */
export function splitLead(text: string): [string, string] {
  const lines = text.trim().split('\n')
  let n = 0
  let len = 0
  while (n < lines.length && len < 250 && (n === 0 || lines[n].trim()))
    len += lines[n++].length
  return [lines.slice(0, n).join('\n'), lines.slice(n).join('\n').trim()]
}
