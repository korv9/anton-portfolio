/**
 * The issue-debate analysis per party, from the precomputed politics/parliament/sakdebatter.json
 * (platform/publish/issue_debates.py). Relative measures throughout: shares of utterances, words
 * per 10,000, differences against the other parties, change against the period before. Pure
 * functions, tested in tests/unit/issues-analytics.test.ts.
 *
 * - Topic share: a party's utterances in debates on an issue area, of all its utterances
 *   (a debate with two areas counts half for each).
 * - Difference from the others: the party's share minus the other parties' combined share, in
 *   percentage points, and their ratio.
 * - Distinctive terms: the log-odds ratio of a word's use by the party against the other parties,
 *   with an informative Dirichlet prior from all parties' use, as a z-score (Monroe, Colaresi &
 *   Quinn 2008). Positive: used relatively more by the party.
 */

export type IssueArea = { key: string; sv: string; en: string }

export type PartyTopics = {
  debates: number
  utterances: number
  topics: Record<string, number>
}

export type SessionTopics = {
  session: string
  debates: number
  parties: Record<string, PartyTopics>
}

export type TermCounts = { words: number; stems: Record<string, number> }

export type SessionTerms = {
  session: string
  parties: Record<string, TermCounts>
  total: TermCounts
}

export type SakData = {
  method: Record<string, string>
  issues: IssueArea[]
  topics: SessionTopics[]
  terms: SessionTerms[]
  words: Record<string, string>
}

export const startYear = (session: string) => Number(session.slice(0, 4))

/** The riksmöten whose first year lies in [from, to]. */
export function sessionsIn<T extends { session: string }>(
  rows: T[],
  from: number,
  to: number,
): T[] {
  return rows.filter(
    (r) => startYear(r.session) >= from && startYear(r.session) <= to,
  )
}

/** Utterance weights per topic for one party, or for all parties but one (`except`). */
export function topicWeights(
  rows: SessionTopics[],
  party: string | null,
  except?: string,
): { weights: Record<string, number>; utterances: number; debates: number } {
  const weights: Record<string, number> = {}
  let utterances = 0
  let debates = 0
  for (const r of rows)
    for (const [p, t] of Object.entries(r.parties)) {
      if (party ? p !== party : p === except) continue
      utterances += t.utterances
      debates += party ? t.debates : 0
      for (const [k, v] of Object.entries(t.topics))
        weights[k] = (weights[k] ?? 0) + v
    }
  if (!party) debates = rows.reduce((s, r) => s + r.debates, 0)
  return { weights, utterances, debates }
}

/** Shares in per cent of the weights, largest first. */
export function shares(weights: Record<string, number>) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  return Object.entries(weights)
    .map(([key, v]) => ({ key, pct: total ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
}

export type Comparison = {
  key: string
  own: number
  others: number
  /** Percentage points. */
  diff: number
  /** own / others; null when the others never spoke on it. */
  ratio: number | null
}

/** A party's topic shares against the other parties' combined shares. */
export function compareWithOthers(
  rows: SessionTopics[],
  party: string,
): Comparison[] {
  const own = shares(topicWeights(rows, party).weights)
  const others = shares(topicWeights(rows, null, party).weights)
  const keys = new Set([...own, ...others].map((x) => x.key))
  return [...keys]
    .map((key) => {
      const o = own.find((x) => x.key === key)?.pct ?? 0
      const r = others.find((x) => x.key === key)?.pct ?? 0
      return {
        key,
        own: o,
        others: r,
        diff: o - r,
        ratio: r > 0 ? o / r : null,
      }
    })
    .sort((a, b) => b.diff - a.diff)
}

/** Each topic's change in share (percentage points) from one period to the next. */
export function topicChange(
  before: SessionTopics[],
  now: SessionTopics[],
  party: string | null,
) {
  const a = shares(topicWeights(before, party).weights)
  const b = shares(topicWeights(now, party).weights)
  const keys = new Set([...a, ...b].map((x) => x.key))
  return [...keys]
    .map((key) => {
      const was = a.find((x) => x.key === key)?.pct ?? 0
      const is = b.find((x) => x.key === key)?.pct ?? 0
      return { key, before: was, now: is, change: is - was }
    })
    .sort((x, y) => y.change - x.change)
}

/** Per riksmöte, the share of each topic for a party (or all parties), for a time series. */
export function topicSeries(
  rows: SessionTopics[],
  party: string | null,
  keys: string[],
) {
  return rows.map((r) => {
    const s = shares(topicWeights([r], party).weights)
    const row: Record<string, number> = {}
    for (const k of keys) row[k] = s.find((x) => x.key === k)?.pct ?? 0
    return { session: r.session, shares: row }
  })
}

/** Summed term counts over riksmöten for a party, or for all parties (null). */
export function termCounts(
  rows: SessionTerms[],
  party: string | null,
): TermCounts {
  const stems: Record<string, number> = {}
  let words = 0
  for (const r of rows) {
    const t = party ? r.parties[party] : r.total
    if (!t) continue
    words += t.words
    for (const [s, n] of Object.entries(t.stems)) stems[s] = (stems[s] ?? 0) + n
  }
  return { words, stems }
}

/**
 * The most used terms, per 10,000 words, leaving out `generic`: words so common in every
 * party's speech (kommer, tidigare, mer …) that they say nothing about the subject.
 */
export function commonTerms(
  t: TermCounts,
  n = 12,
  generic: Set<string> = new Set(),
) {
  return Object.entries(t.stems)
    .filter(([stem]) => !generic.has(stem))
    .map(([stem, c]) => ({
      stem,
      count: c,
      per10k: t.words ? (c / t.words) * 10_000 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

/**
 * Terms used relatively more in `a` than in `b`: log-odds ratio with an informative Dirichlet
 * prior (from a + b), as a z-score. Only stems counted in `a`.
 */
export function distinctiveTerms(
  a: TermCounts,
  b: TermCounts,
  n = 12,
  priorWeight = 0.01,
) {
  const total = a.words + b.words
  const alpha0 = priorWeight * total
  return Object.entries(a.stems)
    .filter(([, y]) => y >= 5)
    .map(([stem, ya]) => {
      const yb = b.stems[stem] ?? 0
      const aw = (alpha0 * (ya + yb)) / total
      const delta =
        Math.log((ya + aw) / (a.words + alpha0 - ya - aw)) -
        Math.log((yb + aw) / (b.words + alpha0 - yb - aw))
      const z = delta / Math.sqrt(1 / (ya + aw) + 1 / (yb + aw))
      return {
        stem,
        z,
        per10k: (ya / a.words) * 10_000,
        otherPer10k: b.words ? (yb / b.words) * 10_000 : 0,
      }
    })
    .filter((t) => t.z > 0)
    .sort((x, y) => y.z - x.z)
    .slice(0, n)
}

/** The `n` most used stems over all parties: the Riksdag's general vocabulary. */
export function genericTerms(rows: SessionTerms[], n = 150): Set<string> {
  const all = termCounts(rows, null)
  return new Set(
    Object.entries(all.stems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([s]) => s),
  )
}

/** All parties' counts minus one party's: what "the others" said. */
export function othersTerms(rows: SessionTerms[], party: string): TermCounts {
  const all = termCounts(rows, null)
  const own = termCounts(rows, party)
  const stems: Record<string, number> = {}
  for (const [s, n] of Object.entries(all.stems))
    stems[s] = n - (own.stems[s] ?? 0)
  return { words: all.words - own.words, stems }
}
