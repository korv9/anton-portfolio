/** AI Act actors: how many articles name each one, and how many give it a duty. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, XGrid, clip, heading, usable } from './txt-kit'

type Actor = {
  actor_id: string
  label_en: string
  articles_mentioning: number
  articles_with_duty_sentences: number
}
const ACTORS = 'ai-act/actors.json'
const d = 'ai-act'

/** Short names, so the longest actor fits beside its row. */
const SHORT: Record<string, string> = {
  gpai_provider: 'GPAI model provider',
  authorised_representative: 'Authorised rep.',
  market_surveillance_authority: 'Market surveillance',
  national_competent_authority: 'National authority',
}
const byMentions = (rows: Actor[]) =>
  [...rows].sort((a, b) => b.articles_mentioning - a.articles_mentioning)

function ActorDumbbell() {
  const data = usable(
    useData<Actor[]>(ACTORS),
    ACTORS,
    (r) => byMentions(r)[0]?.articles_mentioning > 0,
  )
  return (
    <Frame data={data}>
      {(rows) => {
        const as = byMentions(rows)
        const [W, H, m, top, bottom] = [300, 240, 118, 16, 24]
        const ticks = niceTicks(as[0].articles_mentioning)
        const x = linearScale([0, ticks.at(-1)!], [m, W - 10])
        const rh = (H - top - bottom) / as.length
        const cy = (i: number) => top + (i + 0.5) * rh
        return (
          <Svg
            w={W}
            h={H}
            label="Articles mentioning each actor and articles giving it duties"
          >
            <XGrid x={x} ticks={ticks} y0={top - 4} y1={H - bottom + 2} />
            <text className="mean-txt-t" x={W - 10} y={H - 1} textAnchor="end">
              articles
            </text>
            <text
              className="mean-txt-v"
              x={x(as[0].articles_with_duty_sentences)}
              y={top - 6}
              textAnchor="middle"
            >
              duties
            </text>
            <text
              className="mean-txt-t"
              x={x(as[0].articles_mentioning)}
              y={top - 6}
              textAnchor="end"
            >
              named
            </text>
            {as.map((a, i) => (
              <g key={a.actor_id}>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i) + 3.5}
                  textAnchor="end"
                >
                  {clip(SHORT[a.actor_id] ?? a.label_en, 20)}
                </text>
                <line
                  x1={x(a.articles_with_duty_sentences)}
                  x2={x(a.articles_mentioning)}
                  y1={cy(i)}
                  y2={cy(i)}
                  stroke={OTHER}
                  strokeWidth={1.5}
                />
                <circle
                  cx={x(a.articles_mentioning)}
                  cy={cy(i)}
                  r={3.5}
                  fill={OTHER}
                >
                  <title>{`${a.label_en}: named in ${a.articles_mentioning} articles`}</title>
                </circle>
                <circle
                  cx={x(a.articles_with_duty_sentences)}
                  cy={cy(i)}
                  r={3.5}
                  fill={PALETTE[0]}
                >
                  <title>{`${a.label_en}: duties in ${a.articles_with_duty_sentences} articles`}</title>
                </circle>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-actor-dumbbell',
    domain: d,
    sources: ['ai-act/actors.json'],
    title: heading((rows: Actor[]) => {
      const [a] = byMentions(rows)
      return `The ${a.label_en.toLowerCase()} is named in ${a.articles_mentioning} articles and given duties in ${a.articles_with_duty_sentences}`
    }),
    note: 'Articles of the AI Act that name each actor, and those that give it a duty',
    render: () => <ActorDumbbell />,
  },
]
