/** The Workers AI evaluation: quote check and retrieval recall per model setup. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Svg, XGrid, heading, pct, usable } from './txt-kit'

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
const best = (rows: Setup[]) =>
  [...rows].sort((a, b) => b.verified_share - a.verified_share)[0]

function Gauges() {
  const data = usable(useData<Eval>(EVAL), EVAL, (e) => e.compared.length)
  return (
    <Frame data={data}>
      {({ compared }) => {
        const top = best(compared)
        const [W, H, m, y0, bottom] = [300, 220, 118, 22, 22]
        const x = linearScale([0, 1], [m, W - 12])
        const rh = (H - y0 - bottom) / compared.length
        const cy = (i: number) => y0 + (i + 0.5) * rh
        const k = compared[0].k
        const n = compared.length
        const last = compared[n - 1]
        return (
          <Svg
            w={W}
            h={H}
            label="Quote check pass rate and retrieval recall for each Workers AI setup"
          >
            <XGrid
              x={x}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              y0={y0 - 4}
              y1={H - bottom}
              format={pct}
            />
            {/* The bottom row names its two dots; the rows above share them. */}
            <text
              className="mean-txt-v"
              x={x(last.verified_share)}
              y={cy(n - 1) + 15}
              textAnchor="middle"
            >
              quote check
            </text>
            <text
              className="mean-txt-t"
              x={x(last.recall_at_k)}
              y={cy(n - 1) + 15}
              textAnchor="middle"
            >
              {`recall@${k}`}
            </text>
            {compared.map((c, i) => (
              <g key={`${c.model}${c.setting}`}>
                <text
                  className="mean-txt-v"
                  x={m - 6}
                  y={cy(i) - 2}
                  textAnchor="end"
                >
                  {short(c.model)}
                </text>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i) + 10}
                  textAnchor="end"
                >
                  {`${c.setting}, ${c.questions} q.`}
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
                  <title>{`quote check: ${pct(c.verified_share)} of ${c.questions}`}</title>
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
      return `${short(b.model)} (${b.setting}) had the highest quote-check share in this run: ${pct(b.verified_share)} (${b.questions} questions)`
    }),
    note: 'Law questions answered by each Workers AI setup: share whose quotes match the source, and retrieval recall',
    render: () => <Gauges />,
  },
]
