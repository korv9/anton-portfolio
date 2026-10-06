/**
 * The AI Act Observatory's pure logic, unit-tested in frontend/tests/unit/aiact.test.ts:
 * what applies on a given day, the next milestones, the navigator's result for a set of
 * answers, and the changes of a month. No React, no fetching.
 */
import type {
  Answer,
  Article,
  Change,
  Milestone,
  Navigator,
  NavigatorQuestion,
  Obligation,
} from './types'

/** Today as YYYY-MM-DD in local time. */
export function isoToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 'applies' when the date is on or before `today`, 'upcoming' otherwise. */
export function statusOn(date: string, today: string): 'applies' | 'upcoming' {
  return date <= today ? 'applies' : 'upcoming'
}

/**
 * An article's status: applies, partly applies (a second date for part of it is still ahead,
 * or only its first date has passed), or upcoming.
 */
export function articleStatus(
  a: Pick<Article, 'applies_from' | 'applies_from_second'>,
  today: string,
): 'applies' | 'partly' | 'upcoming' {
  if (a.applies_from > today) return 'upcoming'
  if (a.applies_from_second && a.applies_from_second > today) return 'partly'
  return 'applies'
}

/** Milestones that are not document dates, split around `today`, nearest first. */
export function nowAndNext(timeline: Milestone[], today: string) {
  const dated = timeline.filter((m) => m.kind !== 'document')
  const past = dated
    .filter((m) => m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  const next = dated
    .filter((m) => m.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    latest: past[0] ?? null,
    next: next[0] ?? null,
    upcoming: next,
    past,
  }
}

/** Whether a navigator question is shown, given the answers so far. */
export function isShown(
  q: NavigatorQuestion,
  answers: Record<string, Answer>,
): boolean {
  if (q.show_if)
    return Object.entries(q.show_if).every(([id, a]) => answers[id] === a)
  if (q.show_if_any)
    return Object.entries(q.show_if_any).some(([id, a]) => answers[id] === a)
  return true
}

export type NavigatorResult = {
  roles: string[]
  riskClasses: string[]
  obligations: Obligation[]
  articles: string[]
  notes: { question: string; text: { en: string; sv: string } }[]
  answered: number
}

/**
 * The navigator's result: the roles, risk classes and obligations the answers point to, and the
 * notes of the answered questions. Obligations listed per role are included only for roles
 * the answers have established; questions hidden by their condition are ignored.
 */
export function navigatorResult(
  navigator: Navigator,
  answers: Record<string, Answer>,
  obligations: Obligation[],
): NavigatorResult {
  const roles = new Set<string>()
  const classes = new Set<string>()
  const ids = new Set<string>()
  const articles = new Set<string>()
  const notes: NavigatorResult['notes'] = []
  const shown = navigator.questions.filter((q) => isShown(q, answers))
  // Roles first, so role-dependent obligations see every role.
  for (const q of shown) {
    const effect = answers[q.id] ? q.effects[answers[q.id]] : undefined
    effect?.roles?.forEach((r) => roles.add(r))
  }
  let answered = 0
  for (const q of shown) {
    const answer = answers[q.id]
    if (!answer) continue
    answered++
    const effect = q.effects[answer]
    if (!effect) continue
    q.articles.forEach((a) => articles.add(a))
    effect.risk_classes?.forEach((r) => classes.add(r))
    effect.obligations?.forEach((o) => ids.add(o))
    for (const [role, listed] of Object.entries(
      effect.obligations_by_role ?? {},
    ))
      if (roles.has(role)) listed.forEach((o) => ids.add(o))
    if (effect.note) notes.push({ question: q.id, text: effect.note })
  }
  const chosen = obligations.filter((o) => ids.has(o.obligation_id))
  chosen.forEach((o) => articles.add(o.article_number))
  return {
    roles: [...roles],
    riskClasses: [...classes],
    obligations: chosen,
    articles: [...articles].sort(articleOrder),
    notes,
    answered,
  }
}

/** Article numbers in the Act's order: 4 < 4a < 5 < 10. */
export function articleOrder(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  return na - nb || a.localeCompare(b)
}

/** Changes dated in the month of `month` (YYYY-MM). */
export function changesInMonth(changes: Change[], month: string): Change[] {
  return changes.filter((c) => c.change_date.startsWith(month))
}

/** The most recent month with any change, as YYYY-MM. */
export function latestChangeMonth(changes: Change[]): string | null {
  const dates = changes.map((c) => c.change_date).sort()
  return dates.length ? dates[dates.length - 1].slice(0, 7) : null
}

/** Obligations grouped as actor → requirement type → count, for the matrix. */
export function obligationMatrix(obligations: Obligation[]) {
  const matrix = new Map<string, Map<string, number>>()
  for (const o of obligations) {
    const row = matrix.get(o.actor_id) ?? new Map<string, number>()
    row.set(o.requirement_type, (row.get(o.requirement_type) ?? 0) + 1)
    matrix.set(o.actor_id, row)
  }
  return matrix
}

/** Party totals over the whole period from party × year rows: speeches, AI speeches, share. */
export function partyTotals(
  rows: { party: string; speeches: number; ai_speeches: number }[],
) {
  const totals = new Map<string, { speeches: number; ai: number }>()
  for (const r of rows) {
    const t = totals.get(r.party) ?? { speeches: 0, ai: 0 }
    t.speeches += r.speeches
    t.ai += r.ai_speeches
    totals.set(r.party, t)
  }
  return [...totals.entries()]
    .map(([party, t]) => ({ party, ...t, share: t.ai / t.speeches }))
    .sort((a, b) => b.share - a.share)
}

/** Yearly share from monthly rows (sums, not an average of monthly shares). */
export function yearlyShare(
  rows: { month: string; speeches: number; ai_speeches: number }[],
) {
  const years = new Map<string, { speeches: number; ai: number }>()
  for (const r of rows) {
    const y = r.month.slice(0, 4)
    const t = years.get(y) ?? { speeches: 0, ai: 0 }
    t.speeches += r.speeches
    t.ai += r.ai_speeches
    years.set(y, t)
  }
  return [...years.entries()].map(([year, t]) => ({
    year,
    ...t,
    share: t.ai / t.speeches,
  }))
}

/** Words for a framing balance: which side the party's AI speeches lean to, or too few. */
export function balanceWord(
  balance: number | null,
): 'a' | 'b' | 'even' | 'few' {
  if (balance == null) return 'few'
  if (balance > 0.15) return 'a'
  if (balance < -0.15) return 'b'
  return 'even'
}

/** Per year: the sum of numerators over the sum of denominators (never an average of months). */
export function yearlyFromMonths(
  rows: { month: string; numerator: number; denominator: number }[],
): { year: string; numerator: number; denominator: number; share: number }[] {
  const by = new Map<string, { numerator: number; denominator: number }>()
  for (const r of rows) {
    const y = r.month.slice(0, 4)
    const cur = by.get(y) ?? { numerator: 0, denominator: 0 }
    cur.numerator += r.numerator
    cur.denominator += r.denominator
    by.set(y, cur)
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({
      year,
      ...v,
      share: v.denominator ? v.numerator / v.denominator : 0,
    }))
}
