/**
 * The market tab's figures, read from the published files (configs/delivery/schemas): new ads per
 * week, month and year for the whole market (JobStream and the archives, jobs/market*.json) and
 * for the Data/IT roles (archives, jobs/ads-*.json), time to close, technology shares, rising
 * terms and the employers that post the most. Pure, so the unit tests run it without a browser.
 */
import type { Match, MatchClass } from './model.ts'

export type Period = 'week' | 'month' | 'year'
export const PERIODS: Period[] = ['week', 'month', 'year']

type WeekRow = {
  week_start: string
  iso_week: string
  field_id: string
  ads: number
  vacancies: number | null
  days_covered: number
  complete: boolean
}
export type MarketWeekly = {
  latest_complete_week: string | null
  rows: WeekRow[]
}
export type Market = {
  last_month: string
  fields: { id: string; name: string }[]
  /** Per field id ('all' for the whole market): [month, ads, vacancies]. */
  monthly: Record<string, [string, number, number | null][]>
}
export type AdsPeriods = {
  period_kind: Period
  latest_complete: string | null
  rows: {
    period_start: string
    role_family: string
    ads: number
    days_covered: number
    days_in_period: number
    complete: boolean
  }[]
}
export type SkillTrends = {
  month: string
  rows: {
    role_family: string
    skill: string
    ads_with_skill: number
    total_ads: number
    skill_share: number
    previous_year_skill_ads: number
    previous_year_total_ads: number
    previous_year_share: number
    share_yoy_pp: number
  }[]
}
export type Term = {
  term: string
  words: number
  recent_uses: number
  before_uses: number
  employers: number
  z: number
}
type Window = { from: string; to: string }
export type RisingTerms = {
  recent: Window
  before: Window
  rows: {
    role_family: string
    recent_ads: number
    before_ads: number
    rising: Term[]
    falling: Term[]
  }[]
}
export type EmployerTop = {
  rows: {
    period_kind: 'latest_12_months' | 'year'
    from: string
    until: string
    complete: boolean
    employers: { rank: number; employer: string; ads: number }[]
  }[]
}
export type Outcome = 'before_deadline' | 'to_deadline' | 'no_deadline' | 'all'
export type TimeToClose = {
  window_days: number
  min_ads: number
  rows: {
    occupation: string
    outcome: Outcome
    ads: number
    median_days_open: number | null
  }[]
}
/** Each file is absent when it failed to load. */
export type MarketFiles = {
  weekly?: MarketWeekly
  market?: Market
  week?: AdsPeriods
  month?: AdsPeriods
  year?: AdsPeriods
  skills?: SkillTrends
  terms?: RisingTerms
  employers?: EmployerTop
  closing?: TimeToClose
}

/** One period on a line: its first day, its label and whether every day of it is counted. */
export type Point = {
  start: string
  label: string
  ads: number
  complete: boolean
}

/** The ISO week of a day, as 2025-W52. */
export function isoWeek(day: string) {
  const d = new Date(day.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = d.getUTCFullYear()
  const week =
    Math.round((d.getTime() - Date.UTC(year, 0, 4)) / 604_800_000) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

const label = (period: Period, start: string) =>
  period === 'week'
    ? isoWeek(start)
    : period === 'month'
      ? start.slice(0, 7)
      : start.slice(0, 4)

/**
 * The whole market or one occupation field: weeks from market-weekly.json, months and years from
 * market.json. A month after market.json's last month, and a year with fewer than twelve counted
 * months, is incomplete.
 */
export function fieldSeries(
  f: MarketFiles,
  period: Period,
  field: string,
): Point[] {
  if (period === 'week')
    return (f.weekly?.rows ?? [])
      .filter((r) => r.field_id === field)
      .map((r) => ({
        start: r.week_start,
        label: r.iso_week,
        ads: r.ads,
        complete: r.complete,
      }))
  const months = (f.market?.monthly[field] ?? []).map(([m, ads]) => ({
    start: `${m}-01`,
    label: m,
    ads,
    complete: m <= f.market!.last_month,
  }))
  if (period === 'month') return months
  const years = new Map<string, Point & { months: number }>()
  for (const m of months) {
    const y = m.label.slice(0, 4)
    const p = years.get(y) ?? {
      start: `${y}-01-01`,
      label: y,
      ads: 0,
      complete: true,
      months: 0,
    }
    p.ads += m.ads
    p.months += 1
    p.complete &&= m.complete
    years.set(y, p)
  }
  return [...years.values()].map(({ months: n, ...p }) => ({
    ...p,
    complete: p.complete && n === 12,
  }))
}

/** One Data/IT role family ('all' for every classified role) from ads-{week,month,year}.json. */
export function roleSeries(
  file: AdsPeriods | undefined,
  family: string,
): Point[] {
  return (file?.rows ?? [])
    .filter((r) => r.role_family === family)
    .map((r) => ({
      start: r.period_start,
      label: label(file!.period_kind, r.period_start),
      ads: r.ads,
      complete: r.complete,
    }))
}

/** The ids a field slicer offers for a period: the ones its file has rows for. */
export function fieldIds(f: MarketFiles, period: Period) {
  return period === 'week'
    ? [...new Set((f.weekly?.rows ?? []).map((r) => r.field_id))]
    : Object.keys(f.market?.monthly ?? {})
}

const minusDays = (day: string, n: number) =>
  new Date(Date.parse(day + 'T00:00:00Z') - n * 86_400_000)
    .toISOString()
    .slice(0, 10)

/**
 * New ads in the latest complete week for the whole market, and the week before only when that
 * week is complete too: an incomplete week is never compared.
 */
export function latestWeek(weekly?: MarketWeekly) {
  const at = weekly?.latest_complete_week
  const all = (weekly?.rows ?? []).filter((r) => r.field_id === 'all')
  const week = all.find((r) => r.week_start === at && r.complete)
  if (!week) return null
  const before = all.find((r) => r.week_start === minusDays(week.week_start, 7))
  return { week, before: before?.complete ? before : null }
}

/** The median days open over every Data/IT ad removed in the window, when the mart gives one. */
export function medianClose(t?: TimeToClose) {
  const row = t?.rows.find((r) => r.occupation === 'all' && r.outcome === 'all')
  return row?.median_days_open != null ? row : null
}

/** Occupations with a median for the outcome, largest first; 'all' leads. */
export function closeRows(t: TimeToClose | undefined, outcome: Outcome) {
  return (t?.rows ?? [])
    .filter((r) => r.outcome === outcome && r.median_days_open != null)
    .sort(
      (a, b) =>
        Number(b.occupation === 'all') - Number(a.occupation === 'all') ||
        b.ads - a.ads,
    )
}

/**
 * The key figure needs this many ads of the role in both months: the file's own limit (20 ads,
 * five naming the technology) lets a change of a few ads read as a large rise in share.
 */
const KPI_MIN_ROLE_ADS = 100

/** The technology whose share grew the most in percentage points, among roles with volume. */
export function topRise(s?: SkillTrends) {
  const best = (s?.rows ?? [])
    .filter(
      (r) =>
        r.total_ads >= KPI_MIN_ROLE_ADS &&
        r.previous_year_total_ads >= KPI_MIN_ROLE_ADS,
    )
    .sort((a, b) => b.share_yoy_pp - a.share_yoy_pp)[0]
  return best && best.share_yoy_pp > 0 ? best : null
}

export const families = (s?: SkillTrends) => [
  ...new Set((s?.rows ?? []).map((r) => r.role_family)),
]

/** Role families with at least one rising or falling term. */
export const termFamilies = (t?: RisingTerms) =>
  (t?.rows ?? []).filter((r) => r.rising.length + r.falling.length > 0)

/** Current ads per fit, from outside the search to strong. */
const FUNNEL: MatchClass[] = ['outside', 'stretch', 'possible', 'strong']
export function funnel(matches: Match[]) {
  return FUNNEL.map((c) => ({
    class: c,
    ads: matches.filter((m) => m.class === c).length,
  }))
}

/** The first day of the period after `start`. */
function next(period: Period, start: string) {
  const d = new Date(start.slice(0, 10) + 'T00:00:00Z')
  if (period === 'week') d.setUTCDate(d.getUTCDate() + 7)
  else if (period === 'month') d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Periods absent from the file between two of its points: the index of each point that follows
 * a gap (the line breaks there) and the labels of the absent periods.
 */
export function gaps(points: Point[], period: Period) {
  const after = new Set<number>()
  const missing: string[] = []
  for (let i = 1; i < points.length; i++) {
    let at = next(period, points[i - 1].start)
    if (at >= points[i].start) continue
    after.add(i)
    // ponytail: capped walk; a gap longer than 520 periods is named by its first 520.
    for (let n = 0; at < points[i].start && n < 520; n++) {
      missing.push(label(period, at))
      at = next(period, at)
    }
  }
  return { after, missing }
}
