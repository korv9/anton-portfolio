/** Members of the Riksdag and municipal council seats per party. */
import { focal, Frame, shade, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { best, int, pc, PARTIES, Shares, signed, sum } from './pol-kit'

type PartyStat = {
  members: number
  women: number
  ministers: unknown[]
  council_seats: number
  council_seats_before: number
}
type Index = { parties: Record<string, PartyStat> }

const useIndex = () => useData<Index>('politics/parties/index.json')
const present = (d: Index) => PARTIES.filter((p) => d.parties[p])

/** Women and men per party as 100 % rows, most women first. */
function Units() {
  return (
    <Frame data={useIndex()}>
      {(d) => (
        <Shares
          label="Women and men among each party's members of the Riksdag"
          format={String}
          parts={[
            { label: 'Women', colour: focal(true) },
            { label: 'Men', colour: shade(1, 2) },
          ]}
          rows={present(d)
            .map((p) => ({
              key: p,
              label: p,
              values: [
                d.parties[p].women,
                d.parties[p].members - d.parties[p].women,
              ],
              share: d.parties[p].women / d.parties[p].members,
            }))
            .sort((a, b) => b.share - a.share)}
        />
      )}
    </Frame>
  )
}

const councilChange = (s: PartyStat) => s.council_seats - s.council_seats_before

function Dumbbell() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d).sort(
          (a, b) => d.parties[b].council_seats - d.parties[a].council_seats,
        )
        if (!ps.length) return null
        const [, max] = niceDomain(
          0,
          Math.max(
            ...ps.flatMap((p) => [
              d.parties[p].council_seats,
              d.parties[p].council_seats_before,
            ]),
          ),
        )
        const x = linearScale([0, max], [28, 226])
        const row = (i: number) => 14 + i * 27
        const bottom = row(ps.length - 1) + 12
        return (
          <svg
            viewBox="0 0 300 250"
            role="img"
            aria-label="Municipal council seats per party, before and after the election"
          >
            <g className="mean-axis">
              {ticksBetween(0, max, 2).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={bottom} />
                  <text x={x(t)} y={bottom + 14} textAnchor="middle">
                    {int(t)}
                  </text>
                </g>
              ))}
            </g>
            {ps.map((p, i) => {
              const s = d.parties[p]
              const dv = councilChange(s)
              return (
                <g key={p}>
                  <line
                    x1={x(s.council_seats_before)}
                    x2={x(s.council_seats)}
                    y1={row(i)}
                    y2={row(i)}
                    stroke={pc(p)}
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={x(s.council_seats_before)}
                    cy={row(i)}
                    r={4}
                    fill="var(--paper)"
                    stroke={pc(p)}
                    strokeWidth={2}
                  />
                  <circle
                    cx={x(s.council_seats)}
                    cy={row(i)}
                    r={5.5}
                    fill={pc(p)}
                  >
                    <title>{`${p}: ${s.council_seats_before} → ${s.council_seats}`}</title>
                  </circle>
                  <g className="mean-end">
                    <text x={0} y={row(i) + 4}>
                      {p}
                    </text>
                    <text x={298} y={row(i) + 4} textAnchor="end">
                      {int(s.council_seats)}{' '}
                      <tspan className="mean-pol-val">
                        {dv >= 0 ? '+' : '−'}
                        {int(Math.abs(dv))}
                      </tspan>
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

function membersTitle(d: Index) {
  const ps = present(d)
  const w = sum(ps.map((p) => d.parties[p].women))
  const n = sum(ps.map((p) => d.parties[p].members))
  return n
    ? `${w} of the ${n} members from the eight Riksdag parties are women, ${Math.round((100 * w) / n)} %`
    : 'Women and men among Riksdag members'
}

/** The largest gain and the largest loss in council seats, worded by their actual sign. */
function councilTitle(d: Index) {
  const ps = present(d)
  const ch = (p: string) => councilChange(d.parties[p])
  const up = best(ps, ch)
  const down = best(ps, (p) => -ch(p))
  if (!up || !down) return 'Municipal council seats per party'
  const rise =
    ch(up) > 0
      ? `${up} gained the most municipal council seats (${signed(ch(up), 0)})`
      : `every party lost council seats; ${up} the fewest (${signed(ch(up), 0)})`
  const fall =
    ch(down) < 0
      ? `${down} lost the most (${signed(ch(down), 0)})`
      : `${down} gained the fewest (${signed(ch(down), 0)})`
  return `${rise}; ${fall}`
}

export const posts: Post[] = [
  {
    id: 'pol-member-units',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    title: membersTitle,
    note: 'Women and men per party among current members. Source: Riksdagen.',
    render: () => <Units />,
  },
  {
    id: 'pol-council-dumbbell',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    title: councilTitle,
    note: 'Council seats before (open dot) and after (filled) the 2026 election. Source: Valmyndigheten.',
    render: () => <Dumbbell />,
  },
]
