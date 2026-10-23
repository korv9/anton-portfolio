/** Jobs: AI, governance and compliance terms in ads, from ai-act/jobs/*.json. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'
import { Big, D, linePath, maxOf, pct, present, Svg, XLabels } from './job-kit'

type Term = { term_id: string; family: string; label_en: string }
type Summary = { terms: Term[] }
type Monthly = {
  month: string
  term_id: string
  mention_count: number
  ads: number
  share: number
  share_rolling_3m: number | null
}[]

const SUMMARY = 'ai-act/jobs/summary.json'
const MONTHLY = 'ai-act/jobs/monthly.json'

/** Months with under 1,000 ads are left out: a partial month's share is noise. */
const fullMonths = (rows: Monthly) =>
  [...new Set(rows.filter((r) => r.ads >= 1000).map((r) => r.month))].sort()

/** Each term's three-month share by month; a month without a value stays missing. */
const byTerm = (rows: Monthly) => {
  const m = new Map<string, Map<string, number | null>>()
  for (const r of rows) {
    if (r.ads < 1000) continue
    if (!m.has(r.term_id)) m.set(r.term_id, new Map())
    m.get(r.term_id)!.set(r.month, r.share_rolling_3m)
  }
  return m
}

/** Readable names for the term families in summary.json. */
const FAMILY: Record<string, string> = {
  context: 'AI in general',
  regulation: 'The AI Act',
  ai_governance: 'AI governance',
  ml_operations: 'ML operations',
  data: 'Data and privacy',
  general: 'Compliance and risk',
}
/** A term's name short enough for a line's end label. */
const endName = (t: Term) =>
  t.label_en.replace(/ \/ \w+| and data protection| by name/, '')
const monthName = (m: string) =>
  new Date(`${m}-01T12:00`).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

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
            const months = fullMonths(rows)
            const series = byTerm(rows)
            const at = (x: Term, mo: string) =>
              series.get(x.term_id)?.get(mo) ?? null
            const last = (x: Term) => at(x, months.at(-1) ?? '')
            // The term highest in the latest month is the focal line, drawn last; terms with
            // no latest value sort first and get no end label.
            const shown = t.terms
              .filter((x) => x.family === family)
              .sort((a, b) => (last(a) ?? -1) - (last(b) ?? -1))
            const max = maxOf(
              present(shown.flatMap((x) => months.map((mo) => at(x, mo)))),
            )
            if (!months.length || !max) return null
            const ticks = niceTicks(max * 100).map((v) => v / 100)
            const digits = ticks.at(-1)! < 0.02 ? 2 : 1
            const W = 600,
              H = 220,
              L = 46,
              R = 448,
              B = 196
            const x = linearScale([0, Math.max(1, months.length - 1)], [L, R])
            const y = linearScale([0, ticks.at(-1)!], [B, 10])
            const top = shown.at(-1)
            return (
              <>
                <Slicer
                  label="Term family"
                  options={fams}
                  format={(f) => FAMILY[f] ?? f}
                  value={family}
                  onChange={setFamily}
                />
                <p className="mean-cap">{FAMILY[family] ?? family}</p>
                <Svg
                  w={W}
                  h={H}
                  label={`Share of ads mentioning each ${FAMILY[family] ?? family} term, three-month average`}
                >
                  <YAxis
                    ticks={ticks}
                    y={y}
                    x0={L}
                    x1={R}
                    format={(v) => pct(v, digits)}
                  />
                  {shown.map((x0) => (
                    <path
                      key={x0.term_id}
                      fill="none"
                      stroke={focal(x0 === top)}
                      strokeWidth={x0 === top ? 2.5 : 1.5}
                      d={linePath(
                        months.map((mo, i) => {
                          const v = at(x0, mo)
                          return v == null ? null : [x(i), y(v)]
                        }),
                      )}
                    />
                  ))}
                  <EndLabels
                    x={R + 6}
                    top={10}
                    bottom={B}
                    items={shown.flatMap((x0) => {
                      const v = last(x0)
                      return v == null
                        ? []
                        : [
                            {
                              y: y(v),
                              label: endName(x0),
                              color:
                                x0 === top ? focal(true) : 'var(--mean-muted)',
                            },
                          ]
                    })}
                  />
                  <XLabels
                    y={H - 4}
                    items={yearTicks(months).map((tk) => ({
                      x: x(tk.index),
                      label: tk.label,
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

/** The share of ads naming AI in the latest month with at least 1,000 ads. */
const latestAi = (rows: Monthly) => {
  const month = fullMonths(rows).at(-1)
  return rows.find((r) => r.term_id === 'ai_any' && r.month === month)
}

function AiBig() {
  const data = useData<Monthly>(MONTHLY)
  return (
    <Frame data={data}>
      {(rows) => {
        const last = latestAi(rows)
        return last ? (
          <Big
            value={pct(last.share, 1)}
            unit={`of ads in ${monthName(last.month)} mention AI`}
          />
        ) : null
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-ai-big',
    domain: D,
    sources: ['ai-act/jobs/monthly.json'],
    title: 'Share of job ads that mention AI, latest month',
    note: 'Arbetsförmedlingen job ads; months with fewer than 1,000 ads are left out',
    render: () => <AiBig />,
  },
  {
    id: 'job-ai-lines',
    domain: D,
    sources: ['ai-act/jobs/monthly.json', 'ai-act/jobs/summary.json'],
    size: 'wide',
    title: 'How often job ads name AI, data and compliance terms',
    note: 'Share of ads per month, three-month average, 2020 on; one family of terms at a time; Arbetsförmedlingen',
    render: () => <TermLines />,
  },
]
