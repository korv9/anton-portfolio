/** AI Act actors: how many articles name each one, and how many give it a duty. */
import { useContext } from 'react'
import { Frame, OTHER, PALETTE, PostOpen, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, XGrid, clip, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type Actor = {
  actor_id: string
  label_en: string
  label_sv?: string | null
  articles_mentioning: number
  articles_with_duty_sentences: number
}
const ACTORS = 'ai-act/actors.json'
const d = 'ai-act'

/** Short names, so the longest actor fits beside its row. */
const SHORT: Record<string, readonly [string, string]> = {
  gpai_provider: ['GPAI model provider', 'GPAI-leverantör'],
  authorised_representative: ['Authorised rep.', 'Ombud'],
  deployer: ['Deployer', 'Tillhandahållare'],
  downstream_provider: ['Downstream provider', 'Leverantör i senare led'],
  market_surveillance_authority: ['Market surveillance', 'Marknadskontroll'],
  national_competent_authority: ['National authority', 'Nationell myndighet'],
}
const nameOf = (a: Actor) => l(a.label_en, a.label_sv || a.label_en)
const shortOf = (a: Actor) => {
  const s = SHORT[a.actor_id]
  return s ? l(...s) : nameOf(a)
}
const byMentions = (rows: Actor[]) =>
  [...rows].sort((a, b) => b.articles_mentioning - a.articles_mentioning)

function ActorDumbbell() {
  const open = useContext(PostOpen)
  const data = usable(
    useData<Actor[]>(ACTORS),
    ACTORS,
    (r) => byMentions(r)[0]?.articles_mentioning > 0,
  )
  return (
    <Frame data={data}>
      {(rows) => {
        // The thumbnail lists the eight most named actors; opened, all of them.
        const as = byMentions(rows).slice(0, open ? undefined : 8)
        const [W, m, top, bottom] = [300, 118, 16, 24]
        const H = top + bottom + as.length * 22
        const ticks = niceTicks(as[0].articles_mentioning)
        const x = linearScale([0, ticks.at(-1)!], [m, W - 10])
        const rh = (H - top - bottom) / as.length
        const cy = (i: number) => top + (i + 0.5) * rh
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'Articles mentioning each actor and articles giving it duties',
              'Artiklar som nämner varje aktör och artiklar som ger den skyldigheter',
            )}
          >
            <XGrid x={x} ticks={ticks} y0={top - 4} y1={H - bottom + 2} />
            {/* The top row names its two dots, each on its outer side (duties ≤ named). */}
            <text
              className="mean-txt-v"
              x={x(as[0].articles_with_duty_sentences) - 5}
              y={top - 6}
              textAnchor="end"
            >
              {l('duties', 'skyldigheter')}
            </text>
            <text
              className="mean-txt-t"
              x={x(as[0].articles_mentioning) + 5}
              y={top - 6}
              textAnchor="start"
            >
              {l('named', 'nämnd')}
            </text>
            {as.map((a, i) => (
              <g key={a.actor_id}>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i) + 3.5}
                  textAnchor="end"
                >
                  {clip(shortOf(a), 20)}
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
                  <title>
                    {l(
                      `${nameOf(a)}: named in ${a.articles_mentioning} articles`,
                      `${nameOf(a)}: nämns i ${a.articles_mentioning} artiklar`,
                    )}
                  </title>
                </circle>
                <circle
                  cx={x(a.articles_with_duty_sentences)}
                  cy={cy(i)}
                  r={3.5}
                  fill={PALETTE[0]}
                >
                  <title>
                    {l(
                      `${nameOf(a)}: duties in ${a.articles_with_duty_sentences} articles`,
                      `${nameOf(a)}: skyldigheter i ${a.articles_with_duty_sentences} artiklar`,
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

export const posts: Post[] = [
  {
    id: 'txt-act-actor-dumbbell',
    domain: d,
    sources: ['ai-act/actors.json'],
    title: heading((rows: Actor[]) => {
      const [a] = byMentions(rows)
      return l(
        `The ${a.label_en.toLowerCase()} is named in ${a.articles_mentioning} articles and given duties in ${a.articles_with_duty_sentences}`,
        `${nameOf(a)} nämns i ${a.articles_mentioning} artiklar och får skyldigheter i ${a.articles_with_duty_sentences} av dem`,
      )
    }),
    note: [
      'Articles of the AI Act that name each actor, and those that give it a duty',
      'Artiklar i AI-förordningen som nämner varje aktör, och de som ger den en skyldighet',
    ],
    render: () => <ActorDumbbell />,
  },
]
