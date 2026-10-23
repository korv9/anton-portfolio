/** Jobs: AI, governance and compliance terms in ads, from ai-act/jobs/*.json. */
import { color, focal, Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  Bars,
  D,
  fieldName,
  fmt,
  Legend,
  linePath,
  pct,
  sum,
  Svg,
} from './job-kit'

type Term = { term_id: string; family: string; label_en: string }
type Summary = {
  terms: Term[]
  ads: number
  first_month: string
  last_month: string
}
type Monthly = {
  month: string
  term_id: string
  mention_count: number
  ads: number
  share: number
  share_rolling_3m: number | null
}[]
type Fields = {
  year: number
  field_id: string
  field: string
  term_id: string
  mention_count: number
  ads: number
  share: number
}[]

const SUMMARY = 'ai-act/jobs/summary.json'
const MONTHLY = 'ai-act/jobs/monthly.json'
const FIELDS = 'ai-act/jobs/fields.json'

/** Monthly rows per term, in month order. Months with under 1,000 ads are left out: a partial
 * month's share is noise. */
const byTerm = (rows: Monthly) => {
  const m = new Map<string, Monthly>()
  for (const r of rows
    .filter((r) => r.ads >= 1000)
    .sort((a, b) => a.month.localeCompare(b.month)))
    m.set(r.term_id, [...(m.get(r.term_id) ?? []), r])
  return m
}

function Ridgeline() {
  const terms = useData<Summary>(SUMMARY)
  const data = useData<Monthly>(MONTHLY)
  return (
    <Frame data={terms}>
      {(t) => (
        <Frame data={data}>
          {(rows) => {
            const series = byTerm(rows)
            const W = 400,
              H = 780,
              step = (H - 60) / t.terms.length
            return (
              <>
                <Svg
                  w={W}
                  h={H}
                  label="Ridgeline of each term's monthly share, each scaled to its own peak"
                >
                  {t.terms.map((term, j) => {
                    const s = series.get(term.term_id) ?? []
                    const max = Math.max(1e-9, ...s.map((r) => r.share))
                    const base = 60 + j * step + step / 2
                    const x = linearScale([0, s.length - 1], [10, W - 10])
                    const pts = s.map(
                      (r, i) =>
                        [x(i), base - (r.share / max) * step * 1.8] as [
                          number,
                          number,
                        ],
                    )
                    return (
                      <g key={term.term_id}>
                        <title>{`${term.label_en}: peak ${pct(max, 2)}`}</title>
                        <path
                          d={`${linePath(pts)}L${W - 10},${base}L10,${base}Z`}
                          fill={color(j)}
                          opacity={0.85}
                          stroke="var(--paper)"
                          strokeWidth={1.5}
                        />
                      </g>
                    )
                  })}
                </Svg>
                <Legend
                  items={t.terms.map((term, j) => [term.label_en, color(j)])}
                />
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

/** The ai_any rows of the latest full year, highest share first. */
const aiByField = (rows: Fields) => {
  const yr = Math.max(
    ...rows.map((r) => r.year).filter((y) => y < new Date().getFullYear()),
  )
  return {
    yr,
    sel: rows
      .filter((r) => r.term_id === 'ai_any' && r.year === yr)
      .sort((a, b) => b.share - a.share),
  }
}

function FieldLollipop() {
  const data = useData<Fields>(FIELDS)
  return (
    <Frame data={data}>
      {(rows) => (
        <Bars
          label="Share of ads mentioning AI per occupation field, latest full year"
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

function Mentions() {
  const terms = useData<Summary>(SUMMARY)
  const data = useData<Monthly>(MONTHLY)
  return (
    <Frame data={terms}>
      {(t) => (
        <Frame data={data}>
          {(rows) => {
            const count = (id: string) =>
              sum(
                rows
                  .filter((r) => r.term_id === id)
                  .map((r) => r.mention_count),
              )
            const ranked = t.terms
              .map((term) => ({
                key: term.term_id,
                label: term.label_en,
                value: count(term.term_id),
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
    id: 'job-ai-ridgeline',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    size: 'tall',
    render: () => <Ridgeline />,
  },
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
    note: "Share of each field's ads naming AI or machine learning; Arbetsförmedlingen",
    render: () => <FieldLollipop />,
  },
  {
    id: 'job-ai-mentions',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    title: (rows: Monthly) => {
      const n = new Map<string, number>()
      for (const r of rows)
        n.set(r.term_id, (n.get(r.term_id) ?? 0) + r.mention_count)
      const top = [...n].sort((a, b) => b[1] - a[1])[0]?.[0]
      return top === 'privacy'
        ? 'Ads name data protection more often than any AI term'
        : 'How often ads name each AI and compliance term'
    },
    note: 'Number of ads naming each term, 2020 on; Arbetsförmedlingen',
    render: () => <Mentions />,
  },
]
