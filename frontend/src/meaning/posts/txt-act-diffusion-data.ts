/** The AI Act diffusion clock's data: the file's shape and, per term and corpus, the verdict
 * the chart (txt-act-diffusion.tsx) shows and the card's title states. */
import { uniq } from './txt-kit'

type Lag = {
  corpus: string
  term_list: string
  term_id: string
  language: string
  milestone_month: string
  lag_months: number | null
  adoption_month: string | null
  placebo_p: number | null
  window_matches: number | null
}
type Series = {
  term_list: string
  term_id: string
  language: string
  rows: [string, number, number | null][]
}
type Check = {
  corpus: string
  term_id: string
  language: string
  sampled: number
  on_topic: number
  employers: number | null
}
export type Data = {
  terms: { term_id: string; term_sv: string }[]
  amended_terms: { term_id: string; term_sv: string }[]
  milestones: { milestone_id: string; month: string; title_en: string }[]
  corpora: {
    corpus: string
    first_month: string
    last_month: string
    series: Series[]
  }[]
  lags: Lag[]
  precision: Check[]
  diagnostics: { few_matches: number; tests?: number }
}

const NAME: Record<string, string> = {
  riksdag: 'Riksdag speeches',
  job_ads: 'Job ads',
}
export const DEFAULT = 'amended|ai_system'
const key = (s: { term_list: string; term_id: string }) =>
  `${s.term_list}|${s.term_id}`

/** What the pre-registered rule found for one term in one corpus, in a few words. Dates that
 * share a month count once, and short lags that all end in one month say so. */
function verdict(
  lags: Lag[],
  matches: number,
  few: number,
  employers?: number | null,
) {
  if (!matches) return 'No match'
  const found = lags.filter((x) => x.lag_months !== null)
  if (!found.length) return 'No adoption after any date'
  const tested = found.filter((x) => (x.window_matches ?? 0) > few)
  if (!tested.length) return `Too few matches to test (${few} or fewer)`
  const short = tested.filter((x) => (x.placebo_p ?? 1) <= 0.05)
  if (!short.length) return 'No lag shorter than at random dates'
  const ends = uniq(short.map((x) => x.adoption_month))
  if (ends.length === 1)
    return `Shorter than at random dates, all on matches in ${ends[0]}${employers === 1 ? ', from one employer' : ''}`
  const months = uniq(lags.map((x) => x.milestone_month)).length
  return `Shorter than at random dates after ${uniq(short.map((x) => x.milestone_month)).length} of ${months} date months`
}

function readLine(check: Check | undefined) {
  if (!check) return 'Not read by hand'
  const who =
    check.employers === null
      ? ''
      : `, ${check.employers} employer${check.employers === 1 ? '' : 's'}`
  return `${check.on_topic} of ${check.sampled} read by hand on topic${who}`
}

/** The terms on offer, the picked one and a panel per corpus with its verdict. */
export function view(data: Data, pick: string) {
  const { terms, amended_terms, corpora, lags, precision, diagnostics } = data
  // Swedish terms with any match; a term only on the amended list says so.
  const names = new Map<string, string>([
    ...terms.map((t) => [`primary|${t.term_id}`, t.term_sv] as const),
    ...amended_terms
      .filter((t) => !terms.some((p) => p.term_id === t.term_id))
      .map(
        (t) => [`amended|${t.term_id}`, `${t.term_sv} (amended list)`] as const,
      ),
  ])
  const options = [...names.keys()].filter((k) =>
    corpora.some((c) =>
      c.series.some(
        (s) => key(s) === k && s.language === 'sv' && s.rows.some((r) => r[1]),
      ),
    ),
  )
  const term = options.includes(pick) ? pick : options[0]
  const panels = corpora.flatMap((c) => {
    const s = c.series.find((s) => key(s) === term && s.language === 'sv')
    if (!s) return []
    const total = s.rows.reduce((a, r) => a + r[1], 0)
    const own = lags.filter(
      (x) => x.corpus === c.corpus && key(x) === term && x.language === 'sv',
    )
    const read = precision.find(
      (p) =>
        p.corpus === c.corpus &&
        p.term_id === s.term_id &&
        p.language === 'sv' &&
        p.sampled,
    )
    const said = verdict(own, total, diagnostics.few_matches, read?.employers)
    return [
      {
        c,
        s,
        total,
        name: NAME[c.corpus] ?? c.corpus,
        said,
        read: readLine(read),
      },
    ]
  })
  return { names, options, term, panels }
}

/** The verdict for the default term, as the card's title. */
export function headline(data: Data) {
  const { names, term, panels } = view(data, DEFAULT)
  if (!term || !panels.length) return ''
  const word = `“${names.get(term) ?? term}”`
  const said = uniq(panels.map((p) => p.said))
  return said.length === 1
    ? `${word}: ${said[0].toLowerCase()} (${panels.map((p) => p.name.toLowerCase()).join(', ')})`
    : `${word}: ${panels.map((p) => `${p.name.toLowerCase()}, ${p.said.toLowerCase()}`).join('; ')}`
}

/** The caveat the card carries: the lag rule's p-values are not corrected for the many tests. */
export const caveat = (d: Data) =>
  `Timing, not proof: ${d.diagnostics.tests ? `${d.diagnostics.tests} lag tests, each` : 'each lag test'} at p ≤ 0.05 without correction for multiple tests`
