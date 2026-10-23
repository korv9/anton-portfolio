/** Jobs: AI, governance and compliance terms in ads, from ai-act/jobs/*.json. */
import { focal, Frame, useData, type Post } from '../kit'
import { Bars, D, fieldName, fmt, maxOf, pct, sum } from './job-kit'

type Term = { term_id: string; label_en: string }
type Summary = { terms: Term[] }
type Monthly = { term_id: string; mention_count: number }[]
type Fields = {
  year: number
  field_id: string
  field: string
  term_id: string
  ads: number
  share: number
}[]

const SUMMARY = 'ai-act/jobs/summary.json'
const MONTHLY = 'ai-act/jobs/monthly.json'
const FIELDS = 'ai-act/jobs/fields.json'

/** The ai_any rows of the latest year in the file, highest share first. A share needs ads
 * to be one, so fields without ads that year are left out. */
const aiByField = (rows: Fields) => {
  const yr = maxOf(rows.map((r) => r.year))
  return {
    yr,
    sel: rows
      .filter((r) => r.term_id === 'ai_any' && r.year === yr && r.ads > 0)
      .sort((a, b) => b.share - a.share),
  }
}

function FieldLollipop() {
  const data = useData<Fields>(FIELDS)
  return (
    <Frame data={data}>
      {(rows) => (
        <Bars
          label="Share of ads mentioning AI per occupation field, latest year"
          format={(v) => pct(v, 1)}
          rows={aiByField(rows).sel.map((r, j) => ({
            key: r.field_id,
            label: fieldName(r.field),
            value: r.share,
            color: focal(j === 0),
          }))}
        />
      )}
    </Frame>
  )
}

/** Ads naming each term over the whole file, by term id. */
const counts = (rows: Monthly) => {
  const n = new Map<string, number>()
  for (const r of rows)
    n.set(r.term_id, (n.get(r.term_id) ?? 0) + r.mention_count)
  return n
}

function Mentions() {
  const terms = useData<Summary>(SUMMARY)
  const data = useData<Monthly>(MONTHLY)
  return (
    <Frame data={terms}>
      {(t) => (
        <Frame data={data}>
          {(rows) => {
            const n = counts(rows)
            const ranked = t.terms
              .filter((term) => n.has(term.term_id))
              .map((term) => ({
                key: term.term_id,
                label: term.label_en,
                value: n.get(term.term_id)!,
              }))
              .sort((a, b) => b.value - a.value)
            return (
              <Bars
                n={13}
                label="Ads mentioning each term since 2020"
                format={fmt}
                rows={ranked.map((r, j) => ({ ...r, color: focal(j === 0) }))}
              />
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-ai-field-lollipop',
    domain: D,
    sources: ['ai-act/jobs/fields.json'],
    title: (rows: Fields) => {
      const { yr, sel } = aiByField(rows)
      return sel[0]
        ? `${fieldName(sel[0].field)} ads mention AI most often: ${pct(sel[0].share, 1)} in ${yr}`
        : 'Share of ads that mention AI, by field'
    },
    note: "Share of each field's ads naming AI or machine learning, in the latest year of the data, which can be part of a year; Arbetsförmedlingen",
    render: () => <FieldLollipop />,
  },
  {
    id: 'job-ai-mentions',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    title: (rows: Monthly) => {
      const n = [...counts(rows)].filter(([, v]) => v > 0)
      const top = n.sort((a, b) => b[1] - a[1])[0]?.[0]
      return top === 'privacy' && sum(n.map(([, v]) => v)) > 0
        ? 'Ads name data protection more often than any AI term'
        : 'How often ads name each AI and compliance term'
    },
    note: 'Number of ads naming each term, 2020 on; Arbetsförmedlingen',
    render: () => <Mentions />,
  },
]
