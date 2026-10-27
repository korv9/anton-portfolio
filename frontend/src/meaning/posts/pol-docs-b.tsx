/** Tax decisions and how parties voted on them; how far speech tells parties apart. */
import { l } from '../../i18n'
import { fixed } from '../../format'
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
            aria-label={l(
              'Tax decisions per year, raises above the line and cuts below',
              'Skattebeslut per år, höjningar ovanför linjen och sänkningar under',
            )}
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
                  <title>
                    {l(
                      `${yr}: ${n(yr, 'higher')} raised`,
                      `${yr}: ${n(yr, 'higher')} höjda`,
                    )}
                  </title>
                </rect>
                <rect
                  x={x(yr) - w / 2}
                  y={y(0)}
                  width={w}
                  height={y(-n(yr, 'lower')) - y(0)}
                  fill={OTHER}
                >
                  <title>
                    {l(
                      `${yr}: ${n(yr, 'lower')} cut`,
                      `${yr}: ${n(yr, 'lower')} sänkta`,
                    )}
                  </title>
                </rect>
              </g>
            ))}
            <g className="mean-end">
              <text x={258} y={y(hi / 2) + 4}>
                {l('Raises', 'Höjningar')}
              </text>
              <text x={258} y={y(-hi / 2) + 4}>
                {l('Cuts', 'Sänkningar')}
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
          label={l(
            'Votes per party on tax decisions: yes, no and abstain',
            'Röster per parti i skattebeslut: ja, nej och avstår',
          )}
          format={String}
          parts={[
            { label: l('Yes', 'Ja'), colour: focal(true) },
            { label: l('No', 'Nej'), colour: shade(0, 2) },
            { label: l('Abstain', 'Avstår'), colour: shade(1, 2) },
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
    ? l(
        `${top.p} has the highest yes share: ${top.values[0]} of ${top.n} tax decisions`,
        `${top.p} har högst andel ja: ${top.values[0]} av ${top.n} skattebeslut`,
      )
    : l(
        'How each party voted on tax decisions',
        'Hur varje parti röstade i skattebeslut',
      )
}

/** The two measures comparable across sessions; the all-party AUC changes with who sits in the
 * Riksdag, so it is left out. The first is the focal line. */
const AUC = [
  [['Same debate', 'Samma debatt'], 'within_debate_auc'],
  [['Seven parties', 'Sju partier'], 'seven_parties_auc'],
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
            aria-label={l(
              'How well speech text tells parties apart, AUC per session',
              'Hur väl anförandenas text skiljer partierna åt, AUC per riksmöte',
            )}
          >
            <YAxis
              y={y}
              ticks={ticks}
              x0={34}
              x1={500}
              format={(v) => fixed(v, 1)}
            />
            <RefLine
              y={y(0.5)}
              x0={34}
              x1={500}
              label={l('0.5 = chance', '0,5 = slump')}
            />
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
                label: l(label[0], label[1]),
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
        ? l(
            `Tax decisions ${s.join('–')}: ${count(d, 'lower')} cuts, ${count(d, 'higher')} raises`,
            `Skattebeslut ${s.join('–')}: ${count(d, 'lower')} sänkningar, ${count(d, 'higher')} höjningar`,
          )
        : l('Tax decisions per year', 'Skattebeslut per år')
    },
    note: [
      'Decisions per year they took effect. Source: Riksdagen votes.',
      'Beslut per år då de trädde i kraft. Källa: riksdagens omröstningar.',
    ],
    render: () => <TaxTimeline />,
  },
  {
    id: 'pol-tax-votes',
    domain: 'politics',
    sources: ['taxes/decisions.json'],
    title: taxVotesTitle,
    note: [
      "Share of each party's yes, no and abstain votes on tax decisions it voted on. Source: Riksdagen.",
      'Andel ja, nej och avstår för varje parti i de skattebeslut det röstade om. Källa: Riksdagen.',
    ],
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
        ? l(
            `Within the same debate, speech tells parties apart better: AUC ${fixed(a.within_debate_auc, 2)} in ${a.session}, ${fixed(b.within_debate_auc, 2)} in ${b.session}`,
            `Inom samma debatt skiljer anförandena partierna åt allt bättre: AUC ${fixed(a.within_debate_auc, 2)} riksmötet ${a.session}, ${fixed(b.within_debate_auc, 2)} riksmötet ${b.session}`,
          )
        : l(
            'How well speech tells parties apart within a debate',
            'Hur väl anförandena skiljer partierna åt inom en debatt',
          )
    },
    note: [
      'Text-classifier AUC on Riksdag speeches, 0.5 = chance; across debates the seven parties stay level',
      'AUC för en textklassificerare på riksdagens anföranden, 0,5 = slump; mellan debatter ligger de sju partierna kvar på samma nivå',
    ],
    render: () => <Polarization />,
  },
]
