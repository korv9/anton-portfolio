/** Jobs: AI, governance and compliance terms in ads, from ai-act/jobs/*.json. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'
import {
  Big,
  D,
  fieldName,
  Legend,
  linePath,
  pct,
  Svg,
  XLabels,
  YTicks,
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

function TermLines() {
  const terms = useData<Summary>(SUMMARY)
  const data = useData<Monthly>(MONTHLY)
  const [family, setFamily] = useState('ai_governance')
  return (
    <Frame data={terms}>
      {(t) => (
        <Frame data={data}>
          {(rows) => {
            const fams = [...new Set(t.terms.map((x) => x.family))]
            const shown = t.terms.filter((x) => x.family === family)
            const series = byTerm(rows)
            const months =
              series.get(shown[0]?.term_id)?.map((r) => r.month) ?? []
            const max = Math.max(
              1e-6,
              ...shown.flatMap((x) =>
                (series.get(x.term_id) ?? []).map(
                  (r) => r.share_rolling_3m ?? 0,
                ),
              ),
            )
            const ticks = niceTicks(max * 100).map((v) => v / 100)
            const W = 800,
              H = 330,
              L = 48,
              B = 300
            const x = linearScale([0, months.length - 1], [L, W - 8])
            const y = linearScale([0, ticks.at(-1)!], [B, 10])
            return (
              <>
                <Slicer
                  label="Term family"
                  options={fams}
                  value={family}
                  onChange={setFamily}
                />
                <Svg
                  w={W}
                  h={H}
                  label="Share of ads mentioning each term, three-month average"
                >
                  <YTicks
                    ticks={ticks}
                    y={y}
                    x0={L}
                    x1={W - 8}
                    f={(v) => pct(v, 2)}
                  />
                  {shown.map((x0, k) => (
                    <path
                      key={x0.term_id}
                      fill="none"
                      stroke={color(k)}
                      strokeWidth={2.5}
                      d={linePath(
                        (series.get(x0.term_id) ?? []).map((r, i) => [
                          x(i),
                          y(r.share_rolling_3m ?? 0),
                        ]),
                      )}
                    />
                  ))}
                  <XLabels
                    y={H - 10}
                    items={yearTicks(months).map((tk) => ({
                      x: x(tk.index),
                      label: tk.label,
                    }))}
                  />
                </Svg>
                <Legend items={shown.map((x0, k) => [x0.label_en, color(k)])} />
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function AiBig() {
  const data = useData<Monthly>(MONTHLY)
  return (
    <Frame data={data}>
      {(rows) => {
        const ai = byTerm(rows).get('ai_any') ?? []
        const last = ai.at(-1)
        return (
          <Big
            value={last ? pct(last.share, 1) : ''}
            unit="of ads mention AI"
            tone={3}
          />
        )
      }}
    </Frame>
  )
}

function FieldHeat() {
  const terms = useData<Summary>(SUMMARY)
  const data = useData<Fields>(FIELDS)
  const [term, setTerm] = useState('AI (any mention)')
  return (
    <Frame data={terms}>
      {(t) => (
        <Frame data={data}>
          {(rows) => {
            const id =
              t.terms.find((x) => x.label_en === term)?.term_id ?? 'ai_any'
            const sel = rows.filter((r) => r.term_id === id)
            const years = [...new Set(sel.map((r) => r.year))].sort()
            const fields = [...new Set(sel.map((r) => r.field))].sort()
            const max = Math.max(1e-6, ...sel.map((r) => r.share))
            const W = 800,
              L = 200,
              rowH = 380 / fields.length,
              cw = (W - L) / years.length
            return (
              <>
                <Slicer
                  label="Term"
                  options={t.terms.slice(0, 7).map((x) => x.label_en)}
                  value={term}
                  onChange={setTerm}
                />
                <Svg
                  w={W}
                  h={400}
                  label="Heatmap of term share by occupation field and year"
                >
                  {fields.map((f, j) => (
                    <g key={f}>
                      <text
                        x={L - 6}
                        y={j * rowH + rowH / 2 + 3}
                        textAnchor="end"
                        fontSize={9}
                      >
                        {fieldName(f)}
                      </text>
                      {years.map((yr, i) => {
                        const r = sel.find(
                          (s) => s.field === f && s.year === yr,
                        )
                        return (
                          <rect
                            key={yr}
                            x={L + i * cw + 1}
                            y={j * rowH + 1}
                            width={cw - 2}
                            height={rowH - 2}
                            rx={2}
                            fill={`color-mix(in srgb, ${color(0)} ${Math.round(4 + ((r?.share ?? 0) / max) * 96)}%, var(--paper))`}
                          >
                            <title>{`${fieldName(f)} ${yr}: ${pct(r?.share ?? 0, 2)}`}</title>
                          </rect>
                        )
                      })}
                    </g>
                  ))}
                  <XLabels
                    y={396}
                    items={years.map((yr, i) => ({
                      x: L + i * cw + cw / 2,
                      label: String(yr),
                    }))}
                  />
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-ai-big',
    domain: D,
    sources: ['ai-act/jobs/monthly.json'],
    render: () => <AiBig />,
  },
  {
    id: 'job-ai-lines',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    size: 'wide',
    render: () => <TermLines />,
  },
  {
    id: 'job-ai-field-heat',
    domain: D,
    sources: ['ai-act/jobs/fields.json', 'ai-act/jobs/summary.json'],
    size: 'wide',
    render: () => <FieldHeat />,
  },
]
