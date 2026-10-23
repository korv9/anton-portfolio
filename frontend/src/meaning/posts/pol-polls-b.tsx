/** SCB party preference survey, 1972 onward. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { arc, groupBy, pc, pct, PARTIES, uniq, XTicks } from './pol-kit'

type Poll = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
  change_since_last_survey_pp: number | null
}
type Polls = { polls: Poll[] }

const usePolls = () => useData<Polls>('parliament/polls.json')
const months = (d: Polls) => uniq(d.polls.map((p) => p.survey_month)).sort()
const latest = (d: Polls) => {
  const m = months(d).at(-1)
  return d.polls.filter(
    (p) => p.survey_month === m && PARTIES.includes(p.party as never),
  )
}
function Radial() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const ps = latest(d).sort((a, b) => b.share_pct - a.share_pct)
        const max = Math.max(...ps.map((p) => p.share_pct))
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="Latest poll as radial bars"
          >
            {ps.map((p, i) => {
              const r0 = 30 + i * 14
              return (
                <g key={p.party}>
                  <path
                    d={arc(150, 150, r0, r0 + 11, 0, Math.PI * 1.999)}
                    fill="var(--wash)"
                  />
                  <path
                    d={arc(
                      150,
                      150,
                      r0,
                      r0 + 11,
                      0,
                      (p.share_pct / max) * Math.PI * 1.5,
                    )}
                    fill={pc(p.party)}
                  >
                    <title>{`${p.party} ${p.share_pct}%`}</title>
                  </path>
                  <text
                    x={146}
                    y={150 - r0 - 2}
                    textAnchor="end"
                    className="mean-pol-t"
                  >
                    {p.party} {p.share_pct}%
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

function Changes() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const rows = d.polls.filter(
          (r) =>
            r.change_since_last_survey_pp !== null &&
            PARTIES.includes(r.party as never),
        )
        const m = Math.max(
          ...rows.map((r) => Math.abs(r.change_since_last_survey_pp!)),
          1,
        )
        const x = linearScale([-m, m], [30, 294])
        return (
          <svg
            viewBox="0 0 300 240"
            role="img"
            aria-label="Change since previous survey, every survey, per party"
          >
            <line
              x1={x(0)}
              x2={x(0)}
              y1={0}
              y2={224}
              className="mean-pol-grid"
            />
            {PARTIES.map((p, r) => (
              <g key={p}>
                <text x={0} y={r * 27 + 17} className="mean-pol-t">
                  {p}
                </text>
                {rows
                  .filter((q) => q.party === p)
                  .map((q, i) => (
                    <circle
                      key={i}
                      cx={x(q.change_since_last_survey_pp!)}
                      cy={r * 27 + 14 + ((i * 7) % 15) - 7}
                      r={2.4}
                      fill={pc(p)}
                      opacity={0.75}
                    >
                      <title>{`${q.survey_month} ${q.change_since_last_survey_pp}`}</title>
                    </circle>
                  ))}
              </g>
            ))}
            <XTicks
              y={236}
              ticks={[-m, 0, m].map((v) => ({
                x: x(v),
                label: `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`,
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

/** Each party's latest share as a dot on the range of every survey it has been in. */
function Ranges() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const by = groupBy(d.polls, (r) => r.party)
        const rows = latest(d)
          .map((l) => {
            const v = (by.get(l.party) ?? []).map((q) => q.share_pct)
            return {
              p: l.party,
              now: l.share_pct,
              lo: Math.min(...v),
              hi: Math.max(...v),
            }
          })
          .sort((a, b) => b.now - a.now)
        const [, top] = niceDomain(0, Math.max(...rows.map((r) => r.hi)))
        const x = linearScale([0, top], [30, 236])
        const row = (i: number) => 14 + i * 27
        const bottom = row(rows.length - 1) + 12
        return (
          <svg
            viewBox="0 0 300 250"
            role="img"
            aria-label="Latest poll share per party on the range of all its poll shares"
          >
            <g className="mean-axis">
              {ticksBetween(0, top).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={bottom} />
                  <text x={x(t)} y={bottom + 14} textAnchor="middle">
                    {t} %
                  </text>
                </g>
              ))}
            </g>
            {rows.map((r, i) => (
              <g key={r.p}>
                <line
                  x1={x(r.lo)}
                  x2={x(r.hi)}
                  y1={row(i)}
                  y2={row(i)}
                  stroke={pc(r.p)}
                  strokeWidth={6}
                  strokeLinecap="round"
                  opacity={0.35}
                >
                  <title>{`${r.p}: ${r.lo}–${r.hi} %`}</title>
                </line>
                <circle cx={x(r.now)} cy={row(i)} r={5.5} fill={pc(r.p)}>
                  <title>{`${r.p}: ${r.now} %`}</title>
                </circle>
                <g className="mean-end">
                  <text x={0} y={row(i) + 4}>
                    {r.p}
                  </text>
                  <text x={298} y={row(i) + 4} textAnchor="end">
                    {pct(r.now)}
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

function Kpi() {
  const data = usePolls()
  const [p, setP] = useState<string>('S')
  return (
    <Frame data={data}>
      {(d) => {
        const row = latest(d).find((r) => r.party === p)
        return (
          <>
            <Slicer label="Party" options={PARTIES} value={p} onChange={setP} />
            <div className="mean-pol-kpi" style={{ color: pc(p) }}>
              {row ? row.share_pct.toLocaleString('sv-SE') : null}
              <small>%</small>
            </div>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-poll-kpi',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    render: () => <Kpi />,
  },
  {
    id: 'pol-poll-ridges',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    title: (d: Polls) => {
      const last = new Date(`${months(d).at(-1)!.slice(0, 7)}-01T00:00Z`)
      const when = last.toLocaleString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
      return `SCB survey, ${when}: each party against its own highest and lowest`
    },
    note: 'Share of voters, %. Dot: latest survey; bar: every survey since the party was first polled. Source: SCB.',
    render: () => <Ranges />,
  },
  {
    id: 'pol-poll-radial',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    render: () => <Radial />,
  },
  {
    id: 'pol-poll-changes',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    render: () => <Changes />,
  },
]
