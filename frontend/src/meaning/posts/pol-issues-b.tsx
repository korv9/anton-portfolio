/** Fifteen policy issues: who votes with the government, and decisions per issue. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Bars, int, pct, Sub, sum, uniq } from './pol-kit'

type Issue = {
  issue_key: string
  issue_name_en: string
  per_session: { session: string; decisions: number }[]
  parties: { party: string; role: string; with_government_pct: number }[]
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
  const [picked, setKey] = useState<string | null>(null)
  return (
    <Frame data={data}>
      {(d) => {
        const key = picked ?? keys(d)[0]
        const iss = d.issues.find((i) => i.issue_key === key)
        if (!iss?.parties.length) return null
        const rows = [...iss.parties].sort(
          (a, b) => b.with_government_pct - a.with_government_pct,
        )
        // The value column sits right of the plot, clear of a dot at 100 %.
        const x = linearScale([0, 100], [34, 210])
        const row = (i: number) => 12 + i * 22
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
              viewBox={`0 0 300 ${bottom + 20}`}
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

const total = (i: Issue) => sum(i.per_session.map((s) => s.decisions))
const ranked = (d: Issues) => [...d.issues].sort((a, b) => total(b) - total(a))
const sessionSpan = (d: Issues) => {
  const s = uniq(
    d.issues.flatMap((i) => i.per_session.map((p) => p.session)),
  ).sort()
  return s.length ? `${s[0]}–${s.at(-1)}` : ''
}

function DecisionBars() {
  return (
    <Frame data={useIssues()}>
      {(d) => (
        <Bars
          label={`Decisions per issue, ${sessionSpan(d)}, ten most`}
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
      return top
        ? `${top.issue_name_en} had the most Riksdag decisions, ${int(total(top))} in ${sessionSpan(d)}`
        : 'Riksdag decisions per policy area'
    },
    note: 'Decisions per policy area, ten most. Source: Riksdagen.',
    render: () => <DecisionBars />,
  },
]
