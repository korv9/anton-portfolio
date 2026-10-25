/** Tax decisions and how parties voted on them; how far speech tells parties apart. */
import { focal, Frame, OTHER, shade, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { EndLabels, niceDomain, RefLine, XAxis, YAxis } from '../axes'
import { best, every, line, PARTIES, Shares } from './pol-kit'

type Tax = {
  key: string
  year: number
  direction: 'lower' | 'higher'
  vote: { parties: Record<string, [string, string]> }
}
type Taxes = { decisions: Tax[] }
type Polar = {
  sessions: {
    session: string
    all_parties_auc: number
    seven_parties_auc: number
    within_debate_auc: number
  }[]
}

/** First and last year in force, or null without decisions. */
const span = (d: Taxes) => {
  const ys = d.decisions.map((t) => t.year)
  return ys.length ? ([Math.min(...ys), Math.max(...ys)] as const) : null
}
const count = (d: Taxes, dir: Tax['direction']) =>
  d.decisions.filter((t) => t.direction === dir).length

/** Raises above the zero line, cuts below, one column per year in force. */
function TaxTimeline() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => {
        const s = span(d)
        if (!s) return null
        const [y0, y1] = s
        const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
        const n = (yr: number, dir: Tax['direction']) =>
          d.decisions.filter((t) => t.year === yr && t.direction === dir).length
        const top = Math.max(
          1,
          ...years.flatMap((yr) => [n(yr, 'higher'), n(yr, 'lower')]),
        )
        const [, hi] = niceDomain(0, top)
        const x = linearScale([y0, Math.max(y1, y0 + 1)], [36, 244])
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

/** Each party's yes, no and abstain counts over the decisions it voted on, and its yes share
 * of those three. The chart and the title use this one denominator. */
const tally = (d: Taxes) =>
  PARTIES.map((p) => {
    const vs = d.decisions.map((t) => t.vote.parties[p]?.[0])
    const values = VOTES.map((v) => vs.filter((x) => x === v).length)
    const n = values[0] + values[1] + values[2]
    return { p, values, n, yes: n ? values[0] / n : 0 }
  }).filter((r) => r.n)

function TaxVotes() {
  return (
    <Frame data={useData<Taxes>('taxes/decisions.json')}>
      {(d) => (
        <Shares
          label="Votes per party on tax decisions: yes, no and abstain"
          format={String}
          parts={[
            { label: 'Yes', colour: focal(true) },
            { label: 'No', colour: shade(0, 2) },
            { label: 'Abstain', colour: shade(1, 2) },
          ]}
          rows={tally(d)
            .sort((a, b) => b.yes - a.yes)
            .map((r) => ({ key: r.p, label: r.p, values: r.values }))}
        />
      )}
    </Frame>
  )
}

function taxVotesTitle(d: Taxes) {
  const top = best(tally(d), (r) => r.yes)
  return top
    ? `${top.p} has the highest yes share: ${top.values[0]} of ${top.n} tax decisions`
    : 'How each party voted on tax decisions'
}

/** The two measures comparable across sessions; the all-party AUC changes with who sits in the
 * Riksdag, so it is left out. The first is the focal line. */
const AUC = [
  ['Same debate', 'within_debate_auc'],
  ['Seven parties', 'seven_parties_auc'],
] as const

function Polarization() {
  return (
    <Frame data={useData<Polar>('ml/polarization.json')}>
      {(d) => {
        const s = d.sessions
        if (s.length < 2) return null
        const vals = s.flatMap((r) => AUC.map(([, k]) => r[k]))
        // Chance (0.5) stays in view; the top follows the data in tenths.
        const lo = Math.min(0.5, Math.floor(Math.min(...vals) * 10) / 10)
        const hi = Math.max(0.6, Math.ceil(Math.max(...vals) * 10) / 10)
        const x = linearScale([0, s.length - 1], [34, 500])
        const y = linearScale([lo, hi], [174, 10])
        const ticks = Array.from(
          { length: Math.round((hi - lo) * 10) },
          (_, i) => Math.round((lo + 0.1 * (i + 1)) * 10) / 10,
        )
        return (
          <svg
            viewBox="0 0 600 200"
            role="img"
            aria-label="How well speech text tells parties apart, AUC per session"
          >
            <YAxis
              y={y}
              ticks={ticks}
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

export const posts: Post[] = [
  {
    id: 'pol-tax-timeline',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    title: (d: Taxes) => {
      const s = span(d)
      return s
        ? `Tax decisions ${s.join('–')}: ${count(d, 'lower')} cuts, ${count(d, 'higher')} raises`
        : 'Tax decisions per year'
    },
    note: 'Decisions per year they took effect. Source: Riksdagen votes.',
    render: () => <TaxTimeline />,
  },
  {
    id: 'pol-tax-votes',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    title: taxVotesTitle,
    note: "Share of each party's yes, no and abstain votes on tax decisions it voted on. Source: Riksdagen.",
    render: () => <TaxVotes />,
  },
  {
    id: 'pol-polarization',
    domain: 'politics',
    sources: ['ml/polarization.json'],
    size: 'wide',
    title: (d: Polar) => {
      const [a, b] = [d.sessions[0], d.sessions.at(-1)]
      return a && b && a !== b
        ? `Within the same debate, speech tells parties apart better: AUC ${a.within_debate_auc.toFixed(2)} in ${a.session}, ${b.within_debate_auc.toFixed(2)} in ${b.session}`
        : 'How well speech tells parties apart within a debate'
    },
    note: 'Text-classifier AUC on Riksdag speeches, 0.5 = chance; across debates the seven parties stay level',
    render: () => <Polarization />,
  },
]
