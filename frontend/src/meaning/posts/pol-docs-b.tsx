/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { color, Frame, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { every, line, PARTIES, uniq, XTicks, YGrid } from './pol-kit'

type Tax = {
  key: string
  year: number
  direction: 'lower' | 'higher'
  vote: { parties: Record<string, [string, string]> }
}
type Taxes = { decisions: Tax[] }
type Polar = {
  headline: { value: number; metric: string }
  sessions: {
    session: string
    all_parties_auc: number
    seven_parties_auc: number
    within_debate_auc: number
  }[]
}
const DIR = { lower: PALETTE[4], higher: PALETTE[1] }
const VOTE: Record<string, string> = {
  yes: 'var(--accent)',
  no: PALETTE[1],
  abstain: 'var(--wash)',
}

function TaxTimeline() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => {
        const ys = uniq(d.decisions.map((t) => t.year)).sort()
        const x = linearScale([ys[0], ys.at(-1)!], [20, 620])
        return (
          <>
            <svg
              viewBox="0 0 640 200"
              role="img"
              aria-label="Tax decisions per year, raises above and cuts below"
            >
              <line
                x1={10}
                x2={630}
                y1={96}
                y2={96}
                className="mean-pol-grid"
              />
              {ys.flatMap((yr) =>
                (['higher', 'lower'] as const).flatMap((dir) =>
                  d.decisions
                    .filter((t) => t.year === yr && t.direction === dir)
                    .map((t, i) => (
                      <circle
                        key={t.key}
                        cx={x(yr)}
                        cy={dir === 'higher' ? 86 - i * 13 : 106 + i * 13}
                        r={5.5}
                        fill={DIR[dir]}
                      >
                        <title>{t.key}</title>
                      </circle>
                    )),
                ),
              )}
              <XTicks
                y={196}
                ticks={every(ys, 3).map((yr) => ({ x: x(yr), label: yr }))}
              />
            </svg>
            <div className="mean-legend">
              {(['higher', 'lower'] as const).map((k) => (
                <span key={k}>
                  <i style={{ background: DIR[k] }} />
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

function TaxVotes() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => {
        const rows = [...d.decisions].sort((a, b) => a.year - b.year)
        const h = 380 / rows.length
        return (
          <>
            <svg
              viewBox="0 0 200 400"
              role="img"
              aria-label="Each party's vote on every tax decision"
            >
              {PARTIES.map((p, c) => (
                <text
                  key={p}
                  x={24 + c * 22 + 10}
                  y={10}
                  textAnchor="middle"
                  className="mean-pol-t"
                >
                  {p}
                </text>
              ))}
              {rows.map((t, r) => (
                <g key={t.key}>
                  <rect
                    x={0}
                    y={16 + r * h}
                    width={16}
                    height={h - 0.8}
                    fill={DIR[t.direction]}
                  />
                  {PARTIES.map((p, c) => {
                    const v = t.vote.parties[p]?.[0]
                    return v ? (
                      <rect
                        key={p}
                        x={24 + c * 22}
                        y={16 + r * h}
                        width={20}
                        height={h - 0.8}
                        fill={VOTE[v]}
                      >
                        <title>{`${t.key} ${p}: ${v}`}</title>
                      </rect>
                    ) : null
                  })}
                </g>
              ))}
            </svg>
            <div className="mean-legend">
              {Object.keys(VOTE).map((k) => (
                <span key={k}>
                  <i style={{ background: VOTE[k] }} />
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

const AUC = [
  ['all parties', 'all_parties_auc'],
  ['seven', 'seven_parties_auc'],
  ['within debate', 'within_debate_auc'],
] as const

function Polarization() {
  return (
    <Frame data={useData<Polar>('ml/polarization.json')}>
      {(d) => {
        const s = d.sessions
        const x = linearScale([0, s.length - 1], [30, 630])
        const y = linearScale([0.5, 0.8], [170, 8])
        return (
          <>
            <svg
              viewBox="0 0 640 190"
              role="img"
              aria-label="Party separability in speech, AUC per session"
            >
              <YGrid ticks={[0.5, 0.6, 0.7, 0.8]} x0={30} x1={630} y={y} />
              {AUC.map(([, k], i) => (
                <path
                  key={k}
                  d={line(s.map((r, j) => [x(j), y(r[k])]))}
                  fill="none"
                  stroke={color(i * 2)}
                  strokeWidth={2.5}
                />
              ))}
              <XTicks
                y={186}
                ticks={every(s, 4).map((r) => ({
                  x: x(s.indexOf(r)),
                  label: r.session.slice(2),
                }))}
              />
            </svg>
            <div className="mean-legend">
              {AUC.map(([l], i) => (
                <span key={l}>
                  <i style={{ background: color(i * 2) }} />
                  {l}
                </span>
              ))}
            </div>
          </>
        )
      }}
    </Frame>
  )
}

function PolarKpi() {
  return (
    <Frame data={useData<Polar>('ml/polarization.json')}>
      {(d) => (
        <div className="mean-pol-kpi">
          {d.headline.value.toFixed(3)}
          <small>{d.headline.metric}</small>
        </div>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-tax-timeline',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    size: 'wide',
    render: () => <TaxTimeline />,
  },
  {
    id: 'pol-tax-votes',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    size: 'tall',
    render: () => <TaxVotes />,
  },
  {
    id: 'pol-polar-kpi',
    domain: 'politics',
    sources: ['ml/polarization.json'],
    render: () => <PolarKpi />,
  },
  {
    id: 'pol-polarization',
    domain: 'politics',
    sources: ['ml/polarization.json'],
    size: 'wide',
    render: () => <Polarization />,
  },
]
