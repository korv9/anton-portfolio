/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { focal, Frame, OTHER, shade, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { EndLabels, niceDomain, RefLine, XAxis, YAxis } from '../axes'
import { every, line, PARTIES, Shares, uniq } from './pol-kit'

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

const span = (d: Taxes) => {
  const ys = uniq(d.decisions.map((t) => t.year)).sort()
  return [ys[0], ys.at(-1)!] as const
}
const count = (d: Taxes, dir: Tax['direction']) =>
  d.decisions.filter((t) => t.direction === dir).length

/** Raises above the zero line, cuts below, one column pair per year in force. */
function TaxTimeline() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => {
        const [y0, y1] = span(d)
        const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
        const n = (yr: number, dir: Tax['direction']) =>
          d.decisions.filter((t) => t.year === yr && t.direction === dir).length
        const top = Math.max(
          ...years.flatMap((yr) => [n(yr, 'higher'), n(yr, 'lower')]),
        )
        const [, hi] = niceDomain(0, top)
        const x = linearScale([y0, y1], [36, 244])
        const y = linearScale([-hi, hi], [196, 10])
        const w = Math.min(12, (208 / years.length) * 0.72)
        return (
          <svg
            viewBox="0 0 300 220"
            role="img"
            aria-label="Tax decisions per year, raises above the line and cuts below"
          >
            <YAxis
              y={y}
              ticks={[-hi, -hi / 2, 0, hi / 2, hi].filter(Number.isInteger)}
              x0={28}
              x1={252}
              format={(v) => String(Math.abs(v))}
            />
            {years.map((yr) => (
              <g key={yr}>
                <rect
                  x={x(yr) - w / 2}
                  y={y(n(yr, 'higher'))}
                  width={w}
                  height={y(0) - y(n(yr, 'higher'))}
                  fill={focal(true)}
                >
                  <title>{`${yr}: ${n(yr, 'higher')} raised`}</title>
                </rect>
                <rect
                  x={x(yr) - w / 2}
                  y={y(0)}
                  width={w}
                  height={y(-n(yr, 'lower')) - y(0)}
                  fill={OTHER}
                >
                  <title>{`${yr}: ${n(yr, 'lower')} cut`}</title>
                </rect>
              </g>
            ))}
            <g className="mean-end">
              <text x={258} y={y(hi / 2) + 4}>
                Raises
              </text>
              <text x={258} y={y(-hi / 2) + 4}>
                Cuts
              </text>
            </g>
            <XAxis
              y={214}
              x={x}
              ticks={every(years, 6).map((yr) => ({
                value: yr,
                label: String(yr),
              }))}
            />
          </svg>
        )
      }}
    </Frame>
  )
}

const VOTES = ['yes', 'no', 'abstain'] as const

/** Each party's votes on every tax decision as yes, no and abstain shares. */
function TaxVotes() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => {
        const rows = PARTIES.map((p) => {
          const vs = d.decisions.map((t) => t.vote.parties[p]?.[0])
          return {
            key: p,
            label: p,
            values: VOTES.map((v) => vs.filter((x) => x === v).length),
          }
        })
          .filter((r) => r.values.some(Boolean))
          .sort(
            (a, b) =>
              b.values[0] / (b.values[0] + b.values[1] + b.values[2]) -
              a.values[0] / (a.values[0] + a.values[1] + a.values[2]),
          )
        return (
          <Shares
            label="Votes per party on tax decisions: yes, no and abstain"
            format={String}
            parts={[
              { label: 'Yes', colour: focal(true) },
              { label: 'No', colour: shade(0, 2) },
              { label: 'Abstain', colour: shade(1, 2) },
            ]}
            rows={rows}
          />
        )
      }}
    </Frame>
  )
}

/** The party that voted yes most often, as a share of the decisions it voted on. */
function taxVotesTitle(d: Taxes) {
  const yes = PARTIES.map((p) => {
    const vs = d.decisions.map((t) => t.vote.parties[p]?.[0]).filter(Boolean)
    return { p, yes: vs.filter((v) => v === 'yes').length, n: vs.length }
  }).filter((r) => r.n)
  const top = yes.reduce((a, b) => (b.yes / b.n > a.yes / a.n ? b : a))
  return `${top.p} voted yes most often: ${top.yes} of ${top.n} tax decisions`
}

const AUC = [
  ['All parties', 'all_parties_auc'],
  ['Seven parties', 'seven_parties_auc'],
  ['Same debate', 'within_debate_auc'],
] as const

function Polarization() {
  return (
    <Frame data={useData<Polar>('ml/polarization.json')}>
      {(d) => {
        const s = d.sessions
        const x = linearScale([0, s.length - 1], [34, 500])
        const y = linearScale([0.5, 0.8], [174, 10])
        return (
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label="How well speech text tells parties apart, AUC per session"
          >
            <YAxis
              y={y}
              ticks={[0.6, 0.7, 0.8]}
              x0={34}
              x1={500}
              format={(v) => v.toFixed(1)}
            />
            <RefLine y={y(0.5)} x0={34} x1={500} label="0.5 = chance" />
            {AUC.map(([, k], i) => (
              <path
                key={k}
                d={line(s.map((r, j) => [x(j), y(r[k])]))}
                fill="none"
                stroke={focal(i === 0)}
                strokeWidth={i === 0 ? 2.5 : 1.5}
                strokeLinejoin="round"
              />
            ))}
            <EndLabels
              x={508}
              top={14}
              bottom={174}
              items={AUC.map(([label, k], i) => ({
                label,
                y: y(s.at(-1)![k]),
                color: i === 0 ? focal(true) : undefined,
              }))}
            />
            <XAxis
              y={194}
              x={x}
              ticks={every(
                s.map((_, i) => i),
                8,
              ).map((i) => ({ value: i, label: s[i].session }))}
            />
          </svg>
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
    title: (d: Taxes) =>
      `Tax decisions ${span(d).join('–')}: ${count(d, 'lower')} cuts, ${count(d, 'higher')} raises`,
    note: 'Decisions per year they took effect. Source: Riksdagen votes.',
    render: () => <TaxTimeline />,
  },
  {
    id: 'pol-tax-votes',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    title: taxVotesTitle,
    note: "Share of each party's votes on tax decisions since 2007. Source: Riksdagen.",
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
    title: (d: Polar) => {
      const [a, b] = [d.sessions[0], d.sessions.at(-1)!]
      return `How well speech tells parties apart: ${a.all_parties_auc.toFixed(2)} in ${a.session}, ${b.all_parties_auc.toFixed(2)} in ${b.session}`
    },
    note: 'AUC of a text classifier on Riksdag speeches; 0.5 is chance, 1 is perfect.',
    render: () => <Polarization />,
  },
]
