/** Jobs: AI, governance and compliance terms in ads, from ai-act/jobs/*.json. */
import { color, Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  D,
  fieldName,
  fmt,
  KpiGrid,
  Legend,
  linePath,
  pct,
  sum,
  Svg,
  XLabels,
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

function FieldLollipop() {
  const data = useData<Fields>(FIELDS)
  return (
    <Frame data={data}>
      {(rows) => {
        const yr = Math.max(...rows.map((r) => r.year))
        const sel = rows
          .filter((r) => r.term_id === 'ai_any' && r.year === yr)
          .sort((a, b) => b.share - a.share)
        const x = linearScale([0, sel[0]?.share || 1], [150, 380])
        const rowH = 380 / Math.max(1, sel.length)
        return (
          <Svg
            w={400}
            h={400}
            label="Share of ads mentioning AI per field, latest year"
          >
            {sel.map((r, j) => (
              <g key={r.field_id}>
                <title>{`${fieldName(r.field)}: ${pct(r.share, 2)}, ${fmt(r.mention_count)} ads`}</title>
                <text
                  x={144}
                  y={j * rowH + rowH / 2 + 3}
                  textAnchor="end"
                  fontSize={8}
                >
                  {fieldName(r.field)}
                </text>
                <line
                  x1={150}
                  x2={x(r.share)}
                  y1={j * rowH + rowH / 2}
                  y2={j * rowH + rowH / 2}
                  stroke={color(2)}
                  strokeWidth={2}
                />
                <circle
                  cx={x(r.share)}
                  cy={j * rowH + rowH / 2}
                  r={5}
                  fill={color(j < 3 ? 1 : 2)}
                />
              </g>
            ))}
            <XLabels
              y={398}
              items={[
                { x: x(sel[0]?.share ?? 0), label: pct(sel[0]?.share ?? 0, 1) },
              ]}
            />
          </Svg>
        )
      }}
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
          {(rows) => (
            <KpiGrid
              items={[
                [fmt(t.ads), 'ads read'],
                ...t.terms.map(
                  (term) =>
                    [
                      fmt(
                        sum(
                          rows
                            .filter((r) => r.term_id === term.term_id)
                            .map((r) => r.mention_count),
                        ),
                      ),
                      term.label_en,
                    ] as [string, string],
                ),
              ]}
            />
          )}
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
    render: () => <FieldLollipop />,
  },
  {
    id: 'job-ai-mentions',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    size: 'tall',
    render: () => <Mentions />,
  },
]
