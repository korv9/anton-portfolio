/** Fifteen policy issues: decisions, speeches, budget outturn and welfare indicators. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { line, pc, squarify, sum, XTicks } from './pol-kit'

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

function WithGov() {
  const data = useIssues()
  const [key, setKey] = useState('forsvar')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = [
          ...d.issues.find((i) => i.issue_key === key)!.parties,
        ].sort((a, b) => b.with_government_pct - a.with_government_pct)
        const x = linearScale([0, 100], [30, 290])
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
              viewBox="0 0 300 230"
              role="img"
              aria-label={`How often each party voted with the government: ${key}`}
            >
              {rows.map((r, i) => {
                const cy = 14 + i * 26
                return (
                  <g key={r.party}>
                    <line
                      x1={x(0)}
                      x2={x(100)}
                      y1={cy}
                      y2={cy}
                      className="mean-pol-grid"
                    />
                    <line
                      x1={x(r.on_winning_side_pct)}
                      x2={x(r.with_government_pct)}
                      y1={cy}
                      y2={cy}
                      stroke={pc(r.party)}
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(r.on_winning_side_pct)}
                      cy={cy}
                      r={4}
                      fill="var(--paper)"
                      stroke={pc(r.party)}
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(r.with_government_pct)}
                      cy={cy}
                      r={6}
                      fill={pc(r.party)}
                    >
                      <title>{`${r.party}: ${r.with_government_pct}%`}</title>
                    </circle>
                    <text x={0} y={cy + 3} className="mean-pol-t">
                      {r.party}
                    </text>
                  </g>
                )
              })}
              <XTicks
                y={226}
                ticks={[0, 50, 100].map((v) => ({ x: x(v), label: `${v}%` }))}
              />
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

function DecisionTree() {
  return (
    <Frame data={useIssues()}>
      {(d) => {
        const total = (i: Issue) => sum(i.per_session.map((s) => s.decisions))
        const rects = squarify(d.issues, total, { x: 0, y: 0, w: 300, h: 300 })
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="Decisions per issue since 1993, treemap"
          >
            {rects.map((r) => {
              const k = d.issues.indexOf(r.item)
              return (
                <g key={r.item.issue_key}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={color(k)}
                    stroke="var(--paper)"
                    strokeWidth={2}
                  >
                    <title>{`${r.item.issue_name_en}: ${total(r.item)}`}</title>
                  </rect>
                  {r.w > 40 && r.h > 16 && (
                    <text
                      x={r.x + 4}
                      y={r.y + 12}
                      className="mean-pol-t"
                      style={{ fill: 'var(--ink)' }}
                    >
                      {total(r.item)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'pol-issue-withgov', domain: 'politics', render: () => <WithGov /> },
  { id: 'pol-issue-tree', domain: 'politics', render: () => <DecisionTree /> },
  { id: 'pol-issue-welfare', domain: 'politics', render: () => <Welfare /> },
]
