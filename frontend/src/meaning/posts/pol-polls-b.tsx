/** SCB party preference survey, 1972 onward. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { arc, band, groupBy, pc, PARTIES, sum, uniq, XTicks } from './pol-kit'

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

/** Kernel density of each party's poll shares, stacked as ridgelines. */
function Ridges() {
  return (
    <Frame data={usePolls()}>
      {(d) => {
        const by = groupBy(d.polls, (r) => r.party)
        const xs = Array.from({ length: 61 }, (_, i) => i * 0.9)
        const x = linearScale([0, 54], [10, 190])
        return (
          <svg
            viewBox="0 0 200 420"
            role="img"
            aria-label="Distribution of poll shares per party, ridgelines"
          >
            {PARTIES.map((p, r) => {
              const v = (by.get(p) ?? []).map((q) => q.share_pct)
              const dens = xs.map(
                (t) =>
                  sum(v.map((s) => Math.exp(-((t - s) ** 2) / 2))) /
                  (v.length || 1),
              )
              const peak = Math.max(...dens, 1e-9)
              const base = 70 + r * 44
              const pts = xs.map(
                (t, i) =>
                  [x(t), base - (dens[i] / peak) * 64] as [number, number],
              )
              return (
                <g key={p}>
                  <path
                    d={band(
                      pts,
                      pts.map(([px]) => [px, base]),
                    )}
                    fill={pc(p)}
                    stroke="var(--paper)"
                    strokeWidth={1}
                  />
                  <text x={4} y={base - 3} className="mean-pol-t">
                    {p}
                  </text>
                </g>
              )
            })}
            <XTicks
              y={414}
              ticks={[0, 20, 40].map((v) => ({ x: x(v), label: `${v}%` }))}
            />
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
  { id: 'pol-poll-kpi', domain: 'politics', render: () => <Kpi /> },
  {
    id: 'pol-poll-ridges',
    domain: 'politics',
    size: 'tall',
    render: () => <Ridges />,
  },
  { id: 'pol-poll-radial', domain: 'politics', render: () => <Radial /> },
  { id: 'pol-poll-changes', domain: 'politics', render: () => <Changes /> },
]
