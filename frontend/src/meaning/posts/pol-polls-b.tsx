/** SCB party preference survey, 1972 onward. */
import { Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { groupBy, isParty, pc, pct, uniq } from './pol-kit'

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
  return d.polls.filter((p) => p.survey_month === m && isParty(p.party))
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
        if (!rows.length) return null
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

export const posts: Post[] = [
  {
    id: 'pol-poll-ridges',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    title: (d: Polls) => {
      const m = months(d).at(-1)
      if (!m) return "Latest SCB survey against each party's range"
      const when = new Date(`${m.slice(0, 7)}-01T00:00Z`).toLocaleString(
        'en-GB',
        { month: 'long', year: 'numeric', timeZone: 'UTC' },
      )
      return `SCB survey, ${when}: each party against its own highest and lowest`
    },
    note: 'Share of voters, %. Dot: latest survey; bar: every survey since the party was first polled. Source: SCB.',
    render: () => <Ranges />,
  },
]
