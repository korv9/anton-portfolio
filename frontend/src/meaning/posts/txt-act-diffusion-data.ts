/** The AI Act diffusion clock's data: the file's shape and, per term and corpus, the verdict
 * the chart (txt-act-diffusion.tsx) shows and the card's title states. */
import { uniq } from './txt-kit'
import { l } from '../../i18n'

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
  milestones: {
    milestone_id: string
    month: string
    title_en: string
    title_sv?: string | null
  }[]
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

const NAME: Record<string, readonly [string, string]> = {
  riksdag: ['Riksdag speeches', 'Riksdagsanföranden'],
  job_ads: ['Job ads', 'Jobbannonser'],
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
  if (!matches) return l('No match', 'Ingen träff')
  const found = lags.filter((x) => x.lag_months !== null)
  if (!found.length)
    return l('No adoption after any date', 'Inget genomslag efter något datum')
  const tested = found.filter((x) => (x.window_matches ?? 0) > few)
  if (!tested.length)
    return l(
      `Too few matches to test (${few} or fewer)`,
      `För få träffar för att testa (${few} eller färre)`,
    )
  const short = tested.filter((x) => (x.placebo_p ?? 1) <= 0.05)
  if (!short.length)
    return l(
      'No lag shorter than at random dates',
      'Ingen fördröjning kortare än vid slumpade datum',
    )
  const ends = uniq(short.map((x) => x.adoption_month))
  if (ends.length === 1)
    return l(
      `Shorter than at random dates, all on matches in ${ends[0]}${employers === 1 ? ', from one employer' : ''}`,
      `Kortare än vid slumpade datum, allt på träffar i ${ends[0]}${employers === 1 ? ', från en arbetsgivare' : ''}`,
    )
  const months = uniq(lags.map((x) => x.milestone_month)).length
  const after = uniq(short.map((x) => x.milestone_month)).length
  return l(
    `Shorter than at random dates after ${after} of ${months} date months`,
    `Kortare än vid slumpade datum efter ${after} av ${months} datummånader`,
  )
}

function readLine(check: Check | undefined) {
  if (!check) return l('Not read by hand', 'Inte läst för hand')
  const n = check.employers
  const who =
    n === null
      ? ''
      : l(`, ${n} employer${n === 1 ? '' : 's'}`, `, ${n} arbetsgivare`)
  return l(
    `${check.on_topic} of ${check.sampled} read by hand on topic${who}`,
    `${check.on_topic} av ${check.sampled} lästa för hand handlar om ämnet${who}`,
  )
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
        (t) =>
          [
            `amended|${t.term_id}`,
            `${t.term_sv} ${l('(amended list)', '(ändringslistan)')}`,
          ] as const,
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
        name: NAME[c.corpus] ? l(...NAME[c.corpus]) : c.corpus,
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
export const caveat = (d: Data) => {
  const n = d.diagnostics.tests
  return l(
    `Timing, not proof: ${n ? `${n} lag tests, each` : 'each lag test'} at p ≤ 0.05 without correction for multiple tests`,
    `Tidpunkt, inte bevis: ${n ? `${n} fördröjningstest, vart och ett` : 'varje fördröjningstest'} på p ≤ 0,05 utan korrigering för multipla test`,
  )
}
