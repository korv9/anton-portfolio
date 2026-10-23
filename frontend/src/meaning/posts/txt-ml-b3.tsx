/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { Frame, color, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Legend, Svg, palette, ticksIn, uniq } from './txt-kit'

type Pair = {
  concept_id: string
  corpus_a: string
  corpus_b: string
  similarity: number
  baseline_p95: number
}
type Relation = {
  concept_a: string
  concept_b: string
  relation_type: string
  strength: number
}
const d = 'ml'

function PairDots() {
  const data = useData<Pair[]>('concepts/pairs.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const pairs = uniq(rows.map((r) => `${r.corpus_a} · ${r.corpus_b}`))
        const dom = [
          Math.min(0, ...rows.map((r) => r.baseline_p95)),
          Math.max(...rows.map((r) => r.similarity)),
        ] as [number, number]
        const [W, H, m] = [400, 400, 8]
        const x = linearScale(dom, [m, W - m])
        const rh = (H - 14) / pairs.length
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Similarity of matched passages across corpora, with chance level"
            >
              {ticksIn(dom).map((t) => (
                <g key={t}>
                  <line
                    className="mean-txt-grid"
                    x1={x(t)}
                    x2={x(t)}
                    y1={0}
                    y2={H - 14}
                  />
                  <text
                    className="mean-txt-t"
                    x={x(t)}
                    y={H - 2}
                    textAnchor="middle"
                  >
                    {t}
                  </text>
                </g>
              ))}
              {rows.map((r, i) => {
                const j = pairs.indexOf(`${r.corpus_a} · ${r.corpus_b}`)
                return (
                  <g key={i}>
                    <line
                      x1={x(r.baseline_p95)}
                      x2={x(r.baseline_p95)}
                      y1={j * rh + 6}
                      y2={(j + 1) * rh - 6}
                      stroke="var(--ink)"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={x(r.similarity)}
                      cy={(j + 0.5) * rh + ((i % 5) - 2) * 4}
                      r={4}
                      fill={color(j)}
                      fillOpacity={0.8}
                    >
                      <title>{`${r.concept_id}: ${r.similarity.toFixed(3)}`}</title>
                    </circle>
                  </g>
                )
              })}
            </Svg>
            <Legend items={pairs.map((p, j) => [p, color(j)])} />
          </>
        )
      }}
    </Frame>
  )
}
function ConceptWheel() {
  const data = useData<{ concepts: Relation[] }>('concepts/relations.json')
  return (
    <Frame data={data}>
      {({ concepts: rel }) => {
        const nodes = uniq(
          rel.flatMap((r) => [r.concept_a, r.concept_b]),
        ).sort()
        const types = palette(uniq(rel.map((r) => r.relation_type)))
        const pos = (n: string, rad = 140) => {
          const a = (nodes.indexOf(n) / nodes.length) * 2 * Math.PI
          return [200 + rad * Math.sin(a), 200 - rad * Math.cos(a), a] as const
        }
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Relations between concepts around a wheel"
            >
              {rel.map((r, i) => {
                const [x0, y0] = pos(r.concept_a)
                const [x1, y1] = pos(r.concept_b)
                return (
                  <path
                    key={i}
                    d={`M${x0},${y0}Q200,200 ${x1},${y1}`}
                    fill="none"
                    stroke={types.get(r.relation_type)}
                    strokeWidth={0.5 + 4 * r.strength}
                    strokeOpacity={0.6}
                  >
                    <title>{`${r.concept_a} · ${r.concept_b}: ${r.strength}`}</title>
                  </path>
                )
              })}
              {nodes.map((n) => {
                const [x, y, a] = pos(n)
                const [tx, ty] = pos(n, 150)
                return (
                  <g key={n}>
                    <circle cx={x} cy={y} r={4} fill="var(--ink)" />
                    <text
                      className="mean-txt-t"
                      x={tx}
                      y={ty + 3}
                      textAnchor={a > Math.PI ? 'end' : 'start'}
                    >
                      {n}
                    </text>
                  </g>
                )
              })}
            </Svg>
            <Legend items={[...types]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-pair-dots',
    domain: d,
    sources: ['concepts/pairs.json'],
    render: () => <PairDots />,
  },
  {
    id: 'txt-ml-concept-wheel',
    domain: d,
    sources: ['concepts/relations.json'],
    render: () => <ConceptWheel />,
  },
]
