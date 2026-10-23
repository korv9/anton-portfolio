/** Fifteen policy issues: decisions, speeches, budget outturn and welfare indicators. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain } from '../axes'
import { Bars, int, line, pc, Sub, sum } from './pol-kit'

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
/** "Social insurance and migration" → "Social insurance", to fit a small panel. */
const shortName = (i: Issue) => i.issue_name_en.split(' and ')[0]
const decisions = (i: Issue) => sum(i.per_session.map((s) => s.decisions))
const sessionSpan = (d: Issues) => {
  const s = d.issues[0]?.per_session ?? []
  return `${s[0]?.session}–${s.at(-1)?.session}`
}

/** One panel per issue, most decisions first, all on one scale. */
function Multiples() {
  return (
    <Frame data={useIssues()}>
      {(d) => {
        const [, max] = niceDomain(
          0,
          Math.max(
            ...d.issues.flatMap((i) => i.per_session.map((s) => s.decisions)),
          ),
        )
        const ordered = [...d.issues].sort(
          (a, b) => decisions(b) - decisions(a),
        )
        const n = ordered[0]?.per_session.length ?? 1
        const x = linearScale([0, n - 1], [4, 92])
        const y = linearScale([0, max], [56, 20])
        return (
          <svg
            viewBox="0 0 300 310"
            role="img"
            aria-label="Decisions per session for each issue, one panel per issue"
          >
            {ordered.map((iss, k) => (
              <g
                key={iss.issue_key}
                transform={`translate(${(k % 3) * 100},${Math.floor(k / 3) * 62})`}
              >
                <g className="mean-axis">
                  <line x1={4} x2={92} y1={y(0)} y2={y(0)} />
                  <line x1={4} x2={92} y1={y(max)} y2={y(max)} />
                  {k === 2 && (
                    <text x={92} y={11} textAnchor="end">
                      top {max}
                    </text>
                  )}
                </g>
                <path
                  d={line(
                    iss.per_session.map((s, i) => [x(i), y(s.decisions)]),
                  )}
                  fill="none"
                  stroke={focal(true)}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <g className="mean-end">
                  <text x={4} y={12}>
                    {shortName(iss)}
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

const latestYear = (d: Issues) =>
  Math.max(...d.issues.flatMap((i) => i.budget_outturn_msek.map((b) => b.year)))
const outturn = (d: Issues) => {
  const yr = latestYear(d)
  return d.issues
    .map((i) => ({
      i,
      bn:
        (i.budget_outturn_msek.find((b) => b.year === yr)?.outturn_msek ?? 0) /
        1000,
    }))
    .sort((a, b) => b.bn - a.bn)
}

function Outturn() {
  return (
    <Frame data={useIssues()}>
      {(d) => (
        <Bars
          label={`Budget outturn per issue in ${latestYear(d)}, billion kronor`}
          format={(v) => `${int(v)} bn`}
          rows={outturn(d)
            .slice(0, 10)
            .map(({ i, bn }, k) => ({
              key: i.issue_key,
              label: <span title={i.issue_name_en}>{i.issue_name_en}</span>,
              value: bn,
              color: focal(k === 0),
            }))}
        />
      )}
    </Frame>
  )
}

function Speeches() {
  const data = useIssues()
  const [key, setKey] = useState('miljo')
  return (
    <Frame data={data}>
      {(d) => {
        const iss = d.issues.find((i) => i.issue_key === key)!
        const by = new Map<string, number>()
        for (const s of iss.speeches)
          by.set(s.party, (by.get(s.party) ?? 0) + s.speeches)
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
            <Bars
              label={`Speeches per party in debates on ${iss.issue_name_en}`}
              format={int}
              rows={[...by]
                .sort((a, b) => b[1] - a[1])
                .map(([p, n]) => ({
                  key: p,
                  label: p,
                  value: n,
                  color: pc(p),
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-issue-multiples',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) =>
      `Riksdag decisions per session in ${d.issues.length} policy areas, ${sessionSpan(d)}`,
    note: 'Decisions per session; every panel uses the same scale. Source: Riksdagen.',
    render: () => <Multiples />,
  },
  {
    id: 'pol-issue-outturn',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) => {
      const [top] = outturn(d)
      return `${top.i.issue_name_en} had the largest budget outturn in ${latestYear(d)}: ${int(top.bn)} billion kronor`
    },
    note: 'Outturn of the expenditure areas behind each issue, SEK billion, ten largest. Source: Statskontoret.',
    render: () => <Outturn />,
  },
  {
    id: 'pol-issue-speeches',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) =>
      `Speeches per party in issue debates, ${sessionSpan(d)}`,
    note: 'Only speeches in debates linked to a committee report are counted. Source: Riksdagen.',
    render: () => <Speeches />,
  },
]
