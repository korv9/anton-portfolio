/** Fifteen policy issues: decisions, speeches, budget outturn and welfare indicators. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Bars, int, line, pct, Sub, sum } from './pol-kit'

type Issue = {
  issue_key: string
  issue_name_en: string
  per_session: {
    session: string
    decisions: number
    government_won_pct: number
  }[]
  parties: {
    party: string
    role: string
    with_government_pct: number
    on_winning_side_pct: number
  }[]
  speeches: { session: string; party: string; speeches: number }[]
  budget_outturn_msek: { year: number; outturn_msek: number }[]
  welfare: {
    indicator_key: string
    unit: string
    series: { year: number; value: number }[]
  }[]
}
type Issues = { issues: Issue[] }

const useIssues = () => useData<Issues>('parliament/issues.json')
const keys = (d: Issues) => d.issues.map((i) => i.issue_key)
/** An issue's English name, for its key. */
const issueName = (d: Issues) => (k: string) =>
  d.issues.find((i) => i.issue_key === k)?.issue_name_en ?? k

/** One row per party, sorted: how often it voted with the government on the issue. Government
 * parties take the accent, the rest are grey. */
function WithGov() {
  const data = useIssues()
  const [key, setKey] = useState('forsvar')
  return (
    <Frame data={data}>
      {(d) => {
        const iss = d.issues.find((i) => i.issue_key === key)!
        const rows = [...iss.parties].sort(
          (a, b) => b.with_government_pct - a.with_government_pct,
        )
        const x = linearScale([0, 100], [34, 246])
        const row = (i: number) => 14 + i * 26
        const bottom = row(rows.length - 1) + 12
        return (
          <>
            <Slicer
              label="Issue"
              options={keys(d)}
              format={issueName(d)}
              value={key}
              onChange={setKey}
            />
            <Sub>{iss.issue_name_en}</Sub>
            <svg
              viewBox="0 0 300 236"
              role="img"
              aria-label={`How often each party voted with the government: ${iss.issue_name_en}`}
            >
              <g className="mean-axis">
                {[0, 50, 100].map((v) => (
                  <g key={v}>
                    <line x1={x(v)} x2={x(v)} y1={4} y2={bottom} />
                    <text x={x(v)} y={bottom + 14} textAnchor="middle">
                      {v} %
                    </text>
                  </g>
                ))}
              </g>
              {rows.map((r, i) => {
                const gov = r.role === 'government'
                return (
                  <g key={r.party}>
                    <line
                      x1={x(0)}
                      x2={x(r.with_government_pct)}
                      y1={row(i)}
                      y2={row(i)}
                      stroke={focal(gov)}
                      strokeWidth={1}
                    />
                    <circle
                      cx={x(r.with_government_pct)}
                      cy={row(i)}
                      r={5}
                      fill={focal(gov)}
                    >
                      <title>{`${r.party} (${r.role}): ${r.with_government_pct} %`}</title>
                    </circle>
                    <g className="mean-end">
                      <text x={0} y={row(i) + 4}>
                        {r.party}
                      </text>
                      <text x={298} y={row(i) + 4} textAnchor="end">
                        {pct(r.with_government_pct, 0)}
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

function Welfare() {
  const data = useIssues()
  const [key, setKey] = useState('arbete')
  return (
    <Frame data={data}>
      {(d) => {
        const ws = d.issues
          .find((i) => i.issue_key === key)!
          .welfare.filter((w) => w.series.length > 1)
        return (
          <>
            <Slicer
              label="Issue"
              options={keys(d)}
              format={issueName(d)}
              value={key}
              onChange={setKey}
            />
            <svg
              viewBox="0 0 300 220"
              role="img"
              aria-label={`Welfare indicators linked to ${key}`}
            >
              {ws.map((w, k) => {
                const vs = w.series.map((s) => s.value)
                const x = linearScale(
                  [w.series[0].year, w.series.at(-1)!.year],
                  [10, 290],
                )
                const y = linearScale(
                  [Math.min(...vs), Math.max(...vs)],
                  [96 + k * 104, 10 + k * 104],
                )
                const last = w.series.at(-1)!
                return (
                  <g key={w.indicator_key}>
                    <path
                      d={line(w.series.map((s) => [x(s.year), y(s.value)]))}
                      fill="none"
                      stroke={color(k * 2 + 1)}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={x(last.year)}
                      cy={y(last.value)}
                      r={4}
                      fill={color(k * 2 + 1)}
                    />
                    <text x={10} y={y(vs[0]) - 6} className="mean-pol-t">
                      {w.series[0].year} {vs[0]}
                    </text>
                    <text
                      x={290}
                      y={y(last.value) - 8}
                      textAnchor="end"
                      className="mean-pol-t"
                    >
                      {last.year} {last.value}
                    </text>
                  </g>
                )
              })}
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

const total = (i: Issue) => sum(i.per_session.map((s) => s.decisions))
const ranked = (d: Issues) => [...d.issues].sort((a, b) => total(b) - total(a))

function DecisionBars() {
  return (
    <Frame data={useIssues()}>
      {(d) => (
        <Bars
          label="Decisions per issue since 1993/94, ten most"
          format={int}
          rows={ranked(d)
            .slice(0, 10)
            .map((i, k) => ({
              key: i.issue_key,
              label: <span title={i.issue_name_en}>{i.issue_name_en}</span>,
              value: total(i),
              color: focal(k === 0),
            }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-issue-withgov',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: 'How often each party voted with the government, by issue',
    note: 'Decisions under the current government, %. Accent: parties in government. Source: Riksdagen.',
    render: () => <WithGov />,
  },
  {
    id: 'pol-issue-tree',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) => {
      const [top] = ranked(d)
      const s = top.per_session
      return `${top.issue_name_en} had the most Riksdag decisions, ${int(total(top))} in ${s[0].session}–${s.at(-1)!.session}`
    },
    note: 'Decisions per policy area, ten most. Source: Riksdagen.',
    render: () => <DecisionBars />,
  },
  {
    id: 'pol-issue-welfare',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    render: () => <Welfare />,
  },
]
