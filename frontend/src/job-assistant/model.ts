/** Types and pure logic of the job assistant's review list: status, filters, sort, evaluation. */
export type MatchClass = 'strong' | 'possible' | 'stretch' | 'outside'
export const CLASSES: MatchClass[] = [
  'strong',
  'possible',
  'stretch',
  'outside',
]
export const STATUSES = [
  'new',
  'review',
  'interesting',
  'pass',
  'applied',
  'closed',
] as const
export type Status = (typeof STATUSES)[number]
export const LABELS = ['relevant', 'maybe', 'not_relevant'] as const
export type Label = (typeof LABELS)[number]

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
export type Quote = {
  quote: string
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
  matches: { profile: Profile | null; matches: Match[] }
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
}
export type Review = { status: Status; note: string; updated_at?: string }
export type LabelRow = {
  label: Label
  note: string
  shown_class: MatchClass
  updated_at?: string
}
export type Records = {
  reviews: Record<string, Review>
  labels: Record<string, LabelRow>
  available: boolean
}

/** An ad's status: the owner's, else closed when JobTech removed it or the deadline passed, else new. */
export function statusOf(ad: Ad, review?: Review): Status {
  if (review && review.status !== 'new') return review.status
  return ad.removed_at || ad.expired ? 'closed' : 'new'
}

export type Row = {
  ad: Ad
  match: Match
  status: Status
  review?: Review
  label?: LabelRow
}
export type View = {
  classes: MatchClass[] | 'sample'
  status: Status | 'all'
  role: string
  q: string
  sort: 'rank' | 'newest' | 'deadline'
}
export const DEFAULT_VIEW: View = {
  classes: ['strong', 'possible'],
  status: 'all',
  role: 'all',
  q: '',
  sort: 'rank',
}

export function rows(d: Delivered, rec: Records): Row[] {
  const ads = new Map(d.ads.ads.map((a) => [a.id, a]))
  return d.matches.matches.flatMap((match) => {
    const ad = ads.get(match.id)
    if (!ad) return []
    const review = rec.reviews[match.id]
    return [
      {
        ad,
        match,
        review,
        label: rec.labels[match.id],
        status: statusOf(ad, review),
      },
    ]
  })
}

export function filter(all: Row[], v: View): Row[] {
  const q = v.q.trim().toLocaleLowerCase()
  const kept = all.filter(
    (r) =>
      (v.classes === 'sample'
        ? r.match.sample
        : v.classes.includes(r.match.class)) &&
      (v.status === 'all' || r.status === v.status) &&
      (v.role === 'all' || r.match.role === v.role) &&
      (!q ||
        `${r.ad.headline} ${r.ad.employer} ${r.ad.municipality ?? ''}`
          .toLocaleLowerCase()
          .includes(q)),
  )
  const by = {
    rank: (a: Row, b: Row) => a.match.rank - b.match.rank,
    newest: (a: Row, b: Row) =>
      (b.ad.published ?? '').localeCompare(a.ad.published ?? ''),
    deadline: (a: Row, b: Row) =>
      (a.ad.application_deadline ?? '9999').localeCompare(
        b.ad.application_deadline ?? '9999',
      ),
  }[v.sort]
  return kept.sort(by)
}

/**
 * The owner's relevance labels against the classes shown when labelling: how many listed ads
 * (strong or possible) were relevant, how many sampled outside ads were relevant (missed), and
 * every ad whose class and label disagree. Small counts describe this search only.
 */
export function evaluation(labels: Record<string, LabelRow>) {
  const all = Object.entries(labels)
  const listed = all.filter(
    ([, l]) => l.shown_class === 'strong' || l.shown_class === 'possible',
  )
  const outside = all.filter(([, l]) => l.shown_class === 'outside')
  const relevant = (xs: typeof all) =>
    xs.filter(([, l]) => l.label === 'relevant').length
  return {
    labelled: all.length,
    listed: listed.length,
    listedRelevant: relevant(listed),
    outside: outside.length,
    outsideRelevant: relevant(outside),
    disagreements: all
      .filter(
        ([, l]) =>
          (l.label === 'relevant' &&
            (l.shown_class === 'outside' || l.shown_class === 'stretch')) ||
          (l.label === 'not_relevant' &&
            (l.shown_class === 'strong' || l.shown_class === 'possible')),
      )
      .map(([id, l]) => ({ id, ...l })),
  }
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
