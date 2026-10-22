/** Fifteen policy issues: decisions, speeches, budget outturn and welfare indicators. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  band,
  every,
  Legend,
  pc,
  PARTIES,
  sum,
  uniq,
  XTicks,
  YGrid,
} from './pol-kit'

type Issue = {
  issue_key: string
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

function Multiples() {
  return (
    <Frame data={useIssues()}>
      {(d) => {
        const max = Math.max(
          ...d.issues.flatMap((i) => i.per_session.map((s) => s.decisions)),
        )
        return (
          <svg
            viewBox="0 0 300 600"
            role="img"
            aria-label="Decisions per session for each issue, small multiples"
          >
            {d.issues.map((iss, k) => {
              const x = linearScale([0, iss.per_session.length - 1], [4, 96])
              const y = linearScale([0, max], [108, 18])
              const pts = iss.per_session.map(
                (s, i) => [x(i), y(s.decisions)] as [number, number],
              )
              return (
                <g
                  key={iss.issue_key}
                  transform={`translate(${(k % 3) * 100},${Math.floor(k / 3) * 118})`}
                >
                  <path
                    d={band(
                      pts,
                      pts.map(([px]) => [px, 108]),
                    )}
                    fill={color(k)}
                  />
                  <text x={4} y={12} className="mean-pol-t">
                    {iss.issue_key}
                  </text>
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

function Outturn() {
  return (
    <Frame data={useIssues()}>
      {(d) => {
        const years = uniq(
          d.issues.flatMap((i) => i.budget_outturn_msek.map((b) => b.year)),
        ).sort()
        const val = (i: Issue, y: number) =>
          i.budget_outturn_msek.find((b) => b.year === y)?.outturn_msek ?? 0
        const totals = years.map((y) => sum(d.issues.map((i) => val(i, y))))
        const ticks = niceTicks(Math.max(...totals) / 1000)
        const x = linearScale([years[0], years.at(-1)!], [40, 632])
        const yb = linearScale([0, ticks.at(-1)!], [172, 6])
        let base = years.map(() => 0)
        return (
          <>
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label="Budget outturn by issue, billion kronor, stacked"
            >
              <YGrid ticks={ticks} x0={40} x1={632} y={yb} />
              {d.issues.map((iss, k) => {
                const top = years.map((y, j) => base[j] + val(iss, y) / 1000)
                const p = band(
                  top.map((v, j) => [x(years[j]), yb(v)]),
                  base.map((v, j) => [x(years[j]), yb(v)]),
                )
                base = top
                return (
                  <path
                    key={iss.issue_key}
                    d={p}
                    fill={color(k)}
                    stroke="var(--paper)"
                    strokeWidth={0.5}
                  >
                    <title>{iss.issue_key}</title>
                  </path>
                )
              })}
              <XTicks
                y={186}
                ticks={every(years, 4).map((y) => ({ x: x(y), label: y }))}
              />
            </svg>
            <div className="mean-legend">
              {keys(d).map((k, i) => (
                <span key={k}>
                  <i style={{ background: color(i) }} />
                  {k}
                </span>
              ))}
            </div>
          </>
        )
      }}
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
        const ss = uniq(iss.speeches.map((s) => s.session)).sort()
        const tot = ss.map((s) =>
          sum(
            iss.speeches.filter((r) => r.session === s).map((r) => r.speeches),
          ),
        )
        const ticks = niceTicks(Math.max(...tot, 1))
        const y = linearScale([0, ticks.at(-1)!], [172, 6])
        const w = 596 / Math.max(ss.length, 1)
        return (
          <>
            <Slicer
              label="Issue"
              options={keys(d)}
              value={key}
              onChange={setKey}
            />
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label={`Issue debate speeches per party and session: ${key}`}
            >
              <YGrid ticks={ticks} x0={36} x1={632} y={y} />
              {ss.map((s, i) => {
                let acc = 0
                return PARTIES.map((p) => {
                  const v =
                    iss.speeches.find((r) => r.session === s && r.party === p)
                      ?.speeches ?? 0
                  const y0 = acc
                  acc += v
                  return v ? (
                    <rect
                      key={s + p}
                      x={38 + i * w}
                      y={y(acc)}
                      width={w - 1.5}
                      height={y(y0) - y(acc)}
                      fill={pc(p)}
                    >
                      <title>{`${p} ${s}: ${v}`}</title>
                    </rect>
                  ) : null
                })
              })}
              <XTicks
                y={186}
                ticks={every(ss, 4).map((s) => ({
                  x: 38 + ss.indexOf(s) * w + w / 2,
                  label: s.slice(2),
                }))}
              />
            </svg>
            <Legend items={[...PARTIES]} />
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
    size: 'tall',
    render: () => <Multiples />,
  },
  {
    id: 'pol-issue-outturn',
    domain: 'politics',
    size: 'wide',
    render: () => <Outturn />,
  },
  {
    id: 'pol-issue-speeches',
    domain: 'politics',
    size: 'wide',
    render: () => <Speeches />,
  },
]
