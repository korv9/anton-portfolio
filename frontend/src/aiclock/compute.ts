/**
 * The figures of "When does a law arrive?" (#lag-ankomst), computed from the committed AI Act
 * files on load: ai-act/jobs/*, ai-act/politics/*, ai-act/diffusion.json, ai-act/summary.json
 * and ai-act/changes.json. Nothing here is typed in by hand.
 */

export type JobRow = {
  month: string
  term_id: string
  mention_count: number
  ads: number
  share_rolling_3m: number | null
}
export type JobSummary = {
  ads: number
  first_month: string
  last_month: string
  terms: { term_id: string; label_en: string; label_sv: string }[]
}
export type SpeechRow = {
  month: string
  speeches: number
  ai_speeches: number
  ai_act_speeches: number
}
export type SpeechSummary = {
  counts: { speeches: number; ai_speeches: number; ai_act_speeches: number }
  first_date: string
  last_date: string
}
export type Milestone = {
  milestone_id: string
  month: string
  date: string
  title_en: string
  title_sv: string
}
export type Lag = {
  corpus: 'job_ads' | 'riksdag'
  term_list: 'primary' | 'amended'
  term_id: string
  language: string
  milestone_id: string
  lag_months: number | null
  adoption_month: string | null
  placebo_p: number | null
  window_matches: number | null
}
export type Diffusion = {
  milestones: Milestone[]
  corpora: { corpus: string; last_month: string }[]
  lags: Lag[]
  terms: { term_id: string; term_sv: string }[]
  amended_terms: { term_id: string; term_sv: string }[]
  diagnostics: {
    tests: number
    placebo_rounds: number
    few_matches: number
    primary: { tests: number; p_at_most_0_05: number }
    amended: { tests: number; p_at_most_0_05: number }
  }
}
export type ActSummary = {
  counts: {
    articles: number
    articles_changed: number
    articles_inserted: number
  }
  current_version: { published_at: string }
  original_version: { published_at: string }
  amended_by: { celex: string; published_at: string; title: string }[]
}
export type Change = {
  change_kind: string
  change_type: string | null
  article_number: string | null
  provision_title: string | null
}

const year = (month: string) => month.slice(0, 4)
const monthsBetween = (a: string, b: string) =>
  (+year(b) - +year(a)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7))

/** Share of ads per calendar year for one term, from the monthly counts. */
export function jobYears(rows: JobRow[], term: string) {
  const by = new Map<string, { hits: number; ads: number; months: number }>()
  for (const r of rows) {
    if (r.term_id !== term) continue
    const y = by.get(year(r.month)) ?? { hits: 0, ads: 0, months: 0 }
    y.hits += r.mention_count
    y.ads += r.ads
    y.months += 1
    by.set(year(r.month), y)
  }
  return [...by].map(([y, v]) => ({ year: y, ...v, share: v.hits / v.ads }))
}

/** The first month a series has any match. */
export const firstHit = <T extends { month: string }>(
  rows: T[],
  count: (r: T) => number,
) =>
  rows
    .filter((r) => count(r) > 0)
    .map((r) => r.month)
    .sort()[0]

/** Speeches per calendar year: all, mentioning AI, naming the Act. */
export function speechYears(rows: SpeechRow[]) {
  const by = new Map<string, { speeches: number; ai: number; act: number }>()
  for (const r of rows) {
    const y = by.get(year(r.month)) ?? { speeches: 0, ai: 0, act: 0 }
    y.speeches += r.speeches
    y.ai += r.ai_speeches
    y.act += r.ai_act_speeches
    by.set(year(r.month), y)
  }
  return [...by].map(([y, v]) => ({ year: y, ...v, share: v.ai / v.speeches }))
}

export const proposal = (d: Diffusion) =>
  d.milestones.find((m) => m.milestone_id === 'document-52021pc0206')!

/** Months from the Commission's proposal to a first match. */
export const sinceProposal = (d: Diffusion, month: string) =>
  monthsBetween(proposal(d).month, month)

/**
 * The placebo test, read honestly: how many lags have a p-value at all, how many reach 0.05,
 * and what those few rest on (their adoption months and the matches in their windows).
 */
export function lagTest(d: Diffusion) {
  const tested = d.lags.filter((l) => l.placebo_p !== null)
  const sig = tested.filter((l) => l.placebo_p! <= 0.05)
  const few = d.diagnostics.few_matches
  const solid = sig.filter((l) => (l.window_matches ?? 0) > few)
  const thin = sig.filter((l) => (l.window_matches ?? 0) <= few)
  const names = new Map(
    [...d.terms, ...d.amended_terms].map((t) => [t.term_id, t.term_sv]),
  )
  return {
    total: d.lags.length,
    censored: d.lags.length - tested.length,
    tested: tested.length,
    sig: sig.length,
    notSig: tested.length - sig.length,
    solid: solid.length,
    solidMonths: [...new Set(solid.map((l) => l.adoption_month!))].sort(),
    solidMatches: Math.max(0, ...solid.map((l) => l.window_matches ?? 0)),
    solidTerms: [...new Set(solid.map((l) => names.get(l.term_id)!))],
    solidCorpora: [...new Set(solid.map((l) => l.corpus))],
    thin: thin.length,
    thinCorpora: [...new Set(thin.map((l) => l.corpus))],
    thinMatches: Math.max(0, ...thin.map((l) => l.window_matches ?? 0)),
    rounds: d.diagnostics.placebo_rounds,
    few,
  }
}

/** Articles the consolidated text changed or inserted, by number. */
export function amendedArticles(changes: Change[]) {
  const arts = changes.filter(
    (c) => c.change_kind === 'provision' && c.article_number,
  )
  const pick = (type: string) =>
    arts
      .filter((c) => c.change_type === type)
      .map((c) => ({ n: c.article_number!, title: c.provision_title ?? '' }))
      .sort(
        (a, b) => parseFloat(a.n) - parseFloat(b.n) || a.n.localeCompare(b.n),
      )
  return { amended: pick('amended'), inserted: pick('inserted') }
}
