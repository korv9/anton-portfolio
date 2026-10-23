/** Members of the Riksdag and municipal council seats per party. */
import { focal, Frame, shade, tile, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { arc, int, pc, PARTIES, Shares, sum } from './pol-kit'

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
              {ticksBetween(0, max).map((t) => (
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

function Donut() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d)
        const total = sum(ps.map((p) => d.parties[p].members))
        let a = 0
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="Members per party, outer ring; women and men per party, inner ring"
          >
            {ps.map((p) => {
              const s = d.parties[p]
              const a0 = a
              const span = (s.members / total) * Math.PI * 2
              const aw = a0 + span * (s.women / s.members)
              a += span
              return (
                <g key={p}>
                  <path
                    d={arc(150, 150, 100, 140, a0, a0 + span - 0.01)}
                    fill={pc(p)}
                  >
                    <title>{`${p}: ${s.members}`}</title>
                  </path>
                  <path
                    d={arc(150, 150, 74, 96, a0, aw)}
                    fill={pc(p)}
                    opacity={0.55}
                  />
                  <path
                    d={arc(150, 150, 74, 96, aw, a0 + span - 0.01)}
                    fill={pc(p)}
                    opacity={0.2}
                  />
                </g>
              )
            })}
            <text
              x={150}
              y={162}
              textAnchor="middle"
              style={{ fontSize: 36, fontWeight: 600, fill: 'var(--ink)' }}
            >
              {Math.round(
                (100 * sum(ps.map((p) => d.parties[p].women))) / total,
              )}
              %
            </text>
          </svg>
        )
      }}
    </Frame>
  )
}

function Ministers() {
  return (
    <Frame data={useIndex()}>
      {(d) => {
        const ps = present(d).filter((p) => d.parties[p].ministers.length)
        return (
          <div className="mean-pol-grid4">
            {ps.map((p) => (
              <div key={p} className="mean-pol-cell" style={tile(pc(p))}>
                {d.parties[p].ministers.length}
                <small>{p} ministers</small>
              </div>
            ))}
          </div>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-member-units',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    title: (d: Index) => {
      const ps = present(d)
      const w = sum(ps.map((p) => d.parties[p].women))
      const n = sum(ps.map((p) => d.parties[p].members))
      return `${w} of ${n} members of the Riksdag are women, ${Math.round((100 * w) / n)} %`
    },
    note: 'Women and men per party among current members. Source: Riksdagen.',
    render: () => <Units />,
  },
  {
    id: 'pol-council-dumbbell',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    title: (d: Index) => {
      const ps = present(d)
      const by = (f: (a: number, b: number) => boolean) =>
        ps.reduce((a, b) =>
          f(councilChange(d.parties[b]), councilChange(d.parties[a])) ? b : a,
        )
      const up = by((a, b) => a > b)
      const down = by((a, b) => a < b)
      return `${up} gained the most municipal council seats (+${int(councilChange(d.parties[up]))}); ${down} lost the most (−${int(Math.abs(councilChange(d.parties[down])))})`
    },
    note: 'Council seats before (open dot) and after (filled) the 2026 election. Source: Valmyndigheten.',
    render: () => <Dumbbell />,
  },
  {
    id: 'pol-gender-donut',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    render: () => <Donut />,
  },
  {
    id: 'pol-ministers',
    domain: 'politics',
    sources: ['politics/parties/index.json'],
    render: () => <Ministers />,
  },
]
