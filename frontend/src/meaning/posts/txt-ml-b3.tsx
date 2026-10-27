/** The concept layer: how similar the passages matched across corpora are, against chance. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Svg, XGrid, heading, uniq, usable } from './txt-kit'
import { l } from '../../i18n'
import { fixed } from '../../format'

type Pair = {
  concept_id: string
  corpus_a: string
  corpus_b: string
  similarity: number
  baseline_p95: number
}
const PAIRS = 'concepts/pairs.json'
const d = 'ml'
/** The corpora in words. */
const CORPUS: Record<string, [string, string]> = {
  law: ['law', 'juridik'],
  myth: ['myth', 'myter'],
  philosophy: ['philosophy', 'filosofi'],
  politics: ['politics', 'politik'],
}
const corpus = (c: string) => (CORPUS[c] ? l(...CORPUS[c]) : c)
const pair = (p: string) => p.split(' · ').map(corpus).join(' · ')

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
  const data = usable(useData<Pair[]>(PAIRS), PAIRS, (r) => byPair(r).length)
  return (
    <Frame data={data}>
      {(rows) => {
        const pairs = byPair(rows)
        const [W, H, m, top, bottom] = [300, 220, 112, 18, 22]
        const ticks = [0, 0.5, 1]
        const x = linearScale([0, 1], [m, W - 12])
        const rh = (H - top - bottom) / pairs.length
        const cy = (i: number) => top + (i + 0.5) * rh
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'Similarity of matched passages per corpus pair, against the chance level',
              'Likhet mellan matchade stycken per korpuspar, mot slumpnivån',
            )}
          >
            <XGrid
              x={x}
              ticks={ticks}
              y0={top - 4}
              y1={H - bottom}
              format={(t) => fixed(t, 2)}
            />
            <text
              className="mean-txt-t"
              x={x(pairs[0].chance) - 4}
              y={top - 7}
              textAnchor="end"
            >
              {l('chance', 'slump')}
            </text>
            <text className="mean-txt-v" x={x(pairs[0].sim) + 6} y={top - 7}>
              {l('matched', 'matchade')}
            </text>
            {pairs.map((r, i) => (
              <g key={r.p}>
                <text
                  className="mean-txt-t"
                  x={m - 6}
                  y={cy(i) + 3.5}
                  textAnchor="end"
                >
                  {pair(r.p)}
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
                  <title>
                    {l(
                      `${r.p}: median ${fixed(r.sim, 2)} over ${r.n} concepts, chance ${fixed(r.chance, 2)}`,
                      `${pair(r.p)}: median ${fixed(r.sim, 2)} över ${r.n} begrepp, slump ${fixed(r.chance, 2)}`,
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
    id: 'txt-ml-pair-dots',
    domain: d,
    sources: ['concepts/pairs.json'],
    title: heading((rows: Pair[]) => {
      if (!rows.length) return ''
      const above = rows.filter((r) => r.similarity > r.baseline_p95).length
      return above === rows.length
        ? l(
            `All ${rows.length} matched passage pairs are more similar than 95% of random pairs`,
            `Alla ${rows.length} matchade styckepar är mer lika än 95 % av slumpvisa par`,
          )
        : l(
            `${above} of ${rows.length} matched passage pairs are more similar than 95% of random pairs`,
            `${above} av ${rows.length} matchade styckepar är mer lika än 95 % av slumpvisa par`,
          )
    }),
    note: [
      'Cosine similarity of passages matched per concept across two corpora: median, range and the 95th percentile of random pairs',
      'Cosinuslikhet mellan stycken som matchats per begrepp i två korpusar: median, spridning och 95:e percentilen för slumpvisa par',
    ],
    render: () => <PairDots />,
  },
]
