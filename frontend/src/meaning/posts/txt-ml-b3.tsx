/** Symbolic atlas, concept layer and the Workers AI eval: radial bars, treemap, parallel axes, gauges. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Legend, Svg, XGrid, palette, uniq } from './txt-kit'

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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const h = s.length >> 1
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
}
/** Per corpus pair: median similarity of matched passages and median chance level. */
function byPair(rows: Pair[]) {
  const pairs = uniq(rows.map((r) => `${r.corpus_a} · ${r.corpus_b}`))
  return pairs
    .map((p) => {
      const own = rows.filter((r) => `${r.corpus_a} · ${r.corpus_b}` === p)
      return {
        p,
        n: own.length,
        sim: median(own.map((r) => r.similarity)),
        chance: median(own.map((r) => r.baseline_p95)),
        lo: Math.min(...own.map((r) => r.similarity)),
        hi: Math.max(...own.map((r) => r.similarity)),
      }
    })
    .sort((a, b) => b.sim - a.sim)
}

function PairDots() {
  const data = useData<Pair[]>('concepts/pairs.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const pairs = byPair(rows)
        const [W, H, m, top, bottom] = [300, 220, 112, 18, 22]
        const ticks = [0, 0.25, 0.5, 0.75, 1]
        const x = linearScale([0, 1], [m, W - 12])
        const rh = (H - top - bottom) / pairs.length
        const cy = (i: number) => top + (i + 0.5) * rh
        return (
          <Svg
            w={W}
            h={H}
            label="Similarity of matched passages per corpus pair, against the chance level"
          >
            <XGrid
              x={x}
              ticks={ticks}
              y0={top - 4}
              y1={H - bottom}
              format={(t) => t.toFixed(2)}
            />
            <text
              className="mean-txt-t"
              x={x(pairs[0].chance)}
              y={top - 7}
              textAnchor="middle"
            >
              chance
            </text>
            <text className="mean-txt-v" x={x(pairs[0].sim) + 6} y={top - 7}>
              matched
            </text>
            {pairs.map((r, i) => (
              <g key={r.p}>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i) + 3.5}
                  textAnchor="end"
                >
                  {r.p}
                </text>
                <line
                  x1={x(r.lo)}
                  x2={x(r.hi)}
                  y1={cy(i)}
                  y2={cy(i)}
                  stroke={OTHER}
                  strokeWidth={1}
                />
                <line
                  x1={x(r.chance)}
                  x2={x(r.chance)}
                  y1={cy(i) - 5}
                  y2={cy(i) + 5}
                  stroke="var(--mean-ink)"
                  strokeWidth={1.5}
                />
                <circle cx={x(r.sim)} cy={cy(i)} r={4} fill={PALETTE[0]}>
                  <title>{`${r.p}: median ${r.sim.toFixed(2)} over ${r.n} concepts, chance ${r.chance.toFixed(2)}`}</title>
                </circle>
              </g>
            ))}
          </Svg>
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
    title: (rows: Pair[]) => {
      const above = rows.filter((r) => r.similarity > r.baseline_p95).length
      return above === rows.length
        ? `All ${rows.length} matched passage pairs are more similar than 95% of random pairs`
        : `${above} of ${rows.length} matched passage pairs are more similar than 95% of random pairs`
    },
    note: 'Cosine similarity of passages matched per concept across two corpora: median, range and the 95th percentile of random pairs',
    render: () => <PairDots />,
  },
  {
    id: 'txt-ml-concept-wheel',
    domain: d,
    sources: ['concepts/relations.json'],
    render: () => <ConceptWheel />,
  },
]
