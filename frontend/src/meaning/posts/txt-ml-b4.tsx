/** The Workers AI evaluation: quote check and retrieval recall per model setup. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Svg, XGrid, heading, pct, usable } from './txt-kit'
import { l } from '../../i18n'

type Setup = {
  model: string
  setting: string
  questions: number
  verified_share: number
  recall_at_k: number
  k: number
}
type Eval = { compared: Setup[] }
const EVAL = 'workers-ai/eval.json'
/** '@cf/google/gemma-4-26b-a4b-it' → 'gemma-4-26b'. */
const short = (m: string) =>
  m
    .split('/')
    .at(-1)!
    .replace(/-a\d+b-it$/, '')
/** The run's settings in words. */
const SETTING_SV: Record<string, string> = {
  'thinking off': 'utan tänkande',
  'reasoning low': 'lågt resonerande',
  'reasoning medium': 'medelhögt resonerande',
}
const setting = (s: string) => l(s, SETTING_SV[s] ?? s)
const best = (rows: Setup[]) =>
  [...rows].sort((a, b) => b.verified_share - a.verified_share)[0]

function Gauges() {
  const data = usable(useData<Eval>(EVAL), EVAL, (e) => e.compared.length)
  return (
    <Frame data={data}>
      {({ compared }) => {
        const top = best(compared)
        const [W, H, m, y0, bottom] = [300, 170, 118, 22, 22]
        const x = linearScale([0, 1], [m, W - 12])
        const rh = (H - y0 - bottom) / compared.length
        const cy = (i: number) => y0 + (i + 0.5) * rh
        const k = compared[0].k
        const first = compared[0]
        const qFirst = first.verified_share <= first.recall_at_k
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'Quote check pass rate and retrieval recall for each Workers AI setup',
              'Andel godkända citatkontroller och träffsäkerhet i sökningen för varje Workers AI-uppsättning',
            )}
          >
            <XGrid
              x={x}
              ticks={[0, 0.5, 1]}
              y0={y0 - 4}
              y1={H - bottom}
              format={pct}
            />
            {/* The top row names its two dots, each on its outer side; the rows below
                share them. Offsets are in em, so they grow with the text. */}
            <text
              className="mean-txt-v"
              x={x(first.verified_share)}
              y={cy(0)}
              dy="-0.9em"
              textAnchor={qFirst ? 'end' : 'start'}
            >
              {l('quote check', 'citatkontroll')}
            </text>
            <text
              className="mean-txt-t"
              x={x(first.recall_at_k)}
              y={cy(0)}
              dy="-0.9em"
              textAnchor={qFirst ? 'start' : 'end'}
            >
              {`recall@${k}`}
            </text>
            {compared.map((c, i) => (
              <g key={`${c.model}${c.setting}`}>
                <text
                  className="mean-txt-v"
                  x={m - 6}
                  y={cy(i)}
                  dy="-0.2em"
                  textAnchor="end"
                >
                  {short(c.model)}
                </text>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i)}
                  dy="0.9em"
                  textAnchor="end"
                >
                  {setting(c.setting)}
                </text>
                <line
                  x1={x(c.verified_share)}
                  x2={x(c.recall_at_k)}
                  y1={cy(i)}
                  y2={cy(i)}
                  stroke={OTHER}
                  strokeWidth={1.5}
                />
                <circle cx={x(c.recall_at_k)} cy={cy(i)} r={3.5} fill={OTHER}>
                  <title>{`recall@${c.k}: ${pct(c.recall_at_k)}`}</title>
                </circle>
                <circle
                  cx={x(c.verified_share)}
                  cy={cy(i)}
                  r={4}
                  fill={c === top ? PALETTE[0] : 'var(--mean-ink)'}
                >
                  <title>
                    {l(
                      `quote check: ${pct(c.verified_share)} of ${c.questions}`,
                      `citatkontroll: ${pct(c.verified_share)} av ${c.questions}`,
                    )}
                  </title>
                </circle>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
const d = 'ml'
export const posts: Post[] = [
  {
    id: 'txt-ml-gauges',
    domain: d,
    sources: ['workers-ai/eval.json'],
    title: heading(({ compared }: Eval) => {
      const b = best(compared)
      return l(
        `${short(b.model)} (${b.setting}) had the highest quote-check share in this run: ${pct(b.verified_share)} (${b.questions} questions)`,
        `${short(b.model)} (${setting(b.setting)}) klarade citatkontrollen oftast i den här körningen: ${pct(b.verified_share)} (${b.questions} frågor)`,
      )
    }),
    note: [
      'Law questions answered by each Workers AI setup: share whose quotes match the source, and retrieval recall',
      'Juridiska frågor besvarade av varje Workers AI-uppsättning: andel vars citat stämmer med källan, och träffsäkerhet i sökningen (recall)',
    ],
    render: () => <Gauges />,
  },
]
