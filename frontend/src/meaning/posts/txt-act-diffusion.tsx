/** The AI Act diffusion clock: one term's rolling share in Riksdag speeches and in job ads, side by side. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, color, useData, type Post } from '../kit'
import { Legend, Svg, line, uniq } from './txt-kit'

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
type Data = {
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
  diagnostics: { few_matches: number }
}

const NAME: Record<string, string> = {
  riksdag: 'Riksdag speeches',
  job_ads: 'Job ads',
}
/** The few dates named on the chart; the others are unlabelled ticks with a tooltip. */
const ANCHOR: Record<string, string> = {
  'document-52021pc0206': 'proposed',
  'entry-into-force': 'in force',
  'general-application': 'applies',
}
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

function Diffusion() {
  const data = useData<Data>('ai-act/diffusion.json')
  const [pick, setPick] = useState('amended|ai_system')
  return (
    <Frame data={data}>
      {({
        terms,
        amended_terms,
        milestones,
        corpora,
        lags,
        precision,
        diagnostics,
      }) => {
        // Swedish terms with any match; a term only on the amended list says so.
        const names = new Map<string, string>([
          ...terms.map((t) => [`primary|${t.term_id}`, t.term_sv] as const),
          ...amended_terms
            .filter((t) => !terms.some((p) => p.term_id === t.term_id))
            .map(
              (t) =>
                [
                  `amended|${t.term_id}`,
                  `${t.term_sv} (amended list)`,
                ] as const,
            ),
        ])
        const options = [...names.keys()].filter((k) =>
          corpora.some((c) =>
            c.series.some(
              (s) =>
                key(s) === k && s.language === 'sv' && s.rows.some((r) => r[1]),
            ),
          ),
        )
        const term = options.includes(pick) ? pick : options[0]
        const months = uniq(
          corpora.flatMap((c) => c.series[0].rows.map((r) => r[0])),
        ).sort()
        const end = months[months.length - 1]
        const dates = uniq(
          milestones.filter((m) => m.month <= end).map((m) => m.month),
        )
        const [W, H, gap, top, base] = [600, 192, 24, 30, 160]
        const pw = (W - gap) / 2
        const x = (m: string) => (months.indexOf(m) / (months.length - 1)) * pw
        const panels = corpora.flatMap((c) => {
          const s = c.series.find((s) => key(s) === term && s.language === 'sv')
          if (!s) return []
          const total = s.rows.reduce((a, r) => a + r[1], 0)
          const own = lags.filter(
            (x) =>
              x.corpus === c.corpus && key(x) === term && x.language === 'sv',
          )
          const read = precision.find(
            (p) =>
              p.corpus === c.corpus &&
              p.term_id === s.term_id &&
              p.language === 'sv' &&
              p.sampled,
          )
          return [
            {
              c,
              s,
              total,
              name: NAME[c.corpus] ?? c.corpus,
              said: verdict(
                own,
                total,
                diagnostics.few_matches,
                read?.employers,
              ),
              read: readLine(read),
            },
          ]
        })
        return (
          <>
            <Slicer
              label="Term"
              cycles={false}
              options={options}
              format={(k) => names.get(k) ?? k}
              value={term}
              onChange={setPick}
            />
            <Svg
              w={W}
              h={H}
              label={`Three-month share of ${names.get(term)}, with the AI Act's dates. ${panels
                .map((p) => `${p.name}: ${p.total} matches. ${p.said}.`)
                .join(' ')}`}
            >
              {panels.map(({ c, s, total, name, said, read }, j) => {
                const max = Math.max(...s.rows.map((r) => r[2] ?? 0), 1e-9)
                const y = (v: number) => base - ((base - top) * v) / max
                return (
                  <g
                    key={c.corpus}
                    transform={`translate(${j * (pw + gap)},0)`}
                  >
                    <text className="mean-txt-t" x={0} y={10}>
                      {`${name}, ${total} match${total === 1 ? '' : 'es'}`}
                    </text>
                    <text className="mean-txt-t" x={pw} y={10} textAnchor="end">
                      {`max ${(max * 1e5).toFixed(max * 1e5 < 10 ? 1 : 0)} per 100,000`}
                    </text>
                    <text className="mean-txt-t" x={0} y={21}>
                      {said}
                    </text>
                    {dates.map((m) => (
                      <line
                        key={m}
                        x1={x(m)}
                        x2={x(m)}
                        y1={top}
                        y2={base}
                        stroke={OTHER}
                        strokeWidth={0.6}
                        strokeDasharray="2 2"
                      >
                        <title>
                          {milestones
                            .filter((d) => d.month === m)
                            .map((d) => `${m}: ${d.title_en}`)
                            .join('\n')}
                        </title>
                      </line>
                    ))}
                    {milestones
                      .filter((m) => ANCHOR[m.milestone_id] && m.month <= end)
                      .map((m) => (
                        <text
                          key={m.milestone_id}
                          className="mean-txt-t"
                          x={x(m.month) - 2}
                          y={top + 8}
                          textAnchor="end"
                        >
                          {ANCHOR[m.milestone_id]}
                        </text>
                      ))}
                    <line
                      className="mean-txt-grid"
                      x1={0}
                      x2={pw}
                      y1={base}
                      y2={base}
                    />
                    <path
                      d={line(
                        s.rows
                          .filter((r) => r[2] !== null)
                          .map((r) => [x(r[0]), y(r[2]!)]),
                      )}
                      fill="none"
                      stroke={color(0)}
                      strokeWidth={1.4}
                    />
                    {uniq(months.map((m) => m.slice(0, 4)))
                      .filter((yr) => +yr % 2 === 0)
                      .map((yr) => (
                        <text
                          key={yr}
                          className="mean-txt-t"
                          x={x(months.find((m) => m.startsWith(yr))!)}
                          y={base + 12}
                        >
                          {yr}
                        </text>
                      ))}
                    <text className="mean-txt-t" x={0} y={base + 24}>
                      {read}
                    </text>
                    <text
                      className="mean-txt-t"
                      x={pw}
                      y={base + 24}
                      textAnchor="end"
                    >
                      {`${c.first_month} to ${c.last_month}`}
                    </text>
                  </g>
                )
              })}
            </Svg>
            <Legend
              items={[
                ['Share of documents, three months', color(0)],
                ['AI Act dates', OTHER],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-diffusion',
    domain: 'ai-act',
    size: 'wide',
    label: "AI Act: when the Act's terms appear in speeches and job ads",
    render: () => <Diffusion />,
  },
]
