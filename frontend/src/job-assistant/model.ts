/** Types and pure logic of the job assistant: the joined rows, status and the label evaluation. */
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
  'interview',
  'offer',
  'rejected',
  'closed',
] as const
export type Status = (typeof STATUSES)[number]
/** The application pipeline, from saving an ad to the answer; 'interesting' is shown as Saved. */
export const PIPELINE = [
  'interesting',
  'applied',
  'interview',
  'offer',
  'rejected',
] as const satisfies readonly Status[]
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

/** Why rank.py matched nothing or kept the last matches: the reason, the HTTP status (null when unreachable), when. */
export type RouteNote = { reason: string; status: number | null; at: string }

const utc = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 16)} UTC`

/**
 * What the board says when nothing is matched, as [English, Swedish]. Only a 200 without an
 * approved profile means the profile is still to be approved; a blocked or failing route says so.
 */
export function unmatchedNote(n?: RouteNote): [string, string] {
  if (n?.status === 200)
    return [
      'Matching starts when the CV profile is approved.',
      'Matchningen börjar när cv-profilen är godkänd.',
    ]
  if (n?.status === 503)
    return [
      'Nothing is matched yet: the profile store is not set up, so there is no approved profile.',
      'Inget är matchat än: profillagret är inte uppsatt, så det finns ingen godkänd profil.',
    ]
  if (n)
    return n.status == null
      ? [
          `Nothing is matched: the profile could not be reached at ${utc(n.at)}.`,
          `Inget är matchat: profilen gick inte att nå ${utc(n.at)}.`,
        ]
      : [
          `Nothing is matched: the profile could not be read at ${utc(n.at)} (the route answered ${n.status}).`,
          `Inget är matchat: profilen gick inte att läsa ${utc(n.at)} (svaret var ${n.status}).`,
        ]
  return [
    'Nothing is matched: no approved profile was read.',
    'Inget är matchat: ingen godkänd profil lästes.',
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
