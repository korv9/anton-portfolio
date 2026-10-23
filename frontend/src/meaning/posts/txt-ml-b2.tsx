/** Symbolic atlas research steps and cluster sizes, and the concept layer's lift per corpus. */
import { Frame, OTHER, PALETTE, seq, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Svg, fmt, sum, uniq } from './txt-kit'

type SymSummary = {
  evaluation: { cluster_sizes: Record<string, number> }
}
type Steps = {
  steps: { id: string; name: string; metrics: Record<string, number> }[]
}
type Profile = { concept_id: string; corpus_id: string; rank1_lift: number }
const SYM = 'symbolic/summary.json'
const pc = (v: number) => `${Math.round(v * 100)}%`

/** Two shares over the four steps; the first is focal. Higher is better for the first. */
const MEASURES: [string, string][] = [
  ['cross_book_occurrence_share', 'Across books'],
  ['noise_share', 'Unclustered'],
]

function ResearchSteps() {
  const data = useData<Steps>('symbolic/research-history.json')
  return (
    <Frame data={data}>
      {({ steps }) => {
        const [W, H, l, r, top, bottom] = [300, 230, 34, 96, 10, 32]
        const x = linearScale([0, steps.length - 1], [l + 22, W - r - 8])
        const y = linearScale([0, 1], [H - bottom, top])
        const v = (i: number, k: string) => steps[i].metrics[k] ?? 0
        return (
          <Svg
            w={W}
            h={H}
            label="Symbolic atlas measures across four research steps"
          >
            <YAxis
              y={y}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              x0={l}
              x1={W - r}
              format={pc}
            />
            {/* Step names alternate between two lines so neighbours never touch. */}
            <g className="mean-axis">
              {steps.map((s, i) => (
                <text
                  key={s.id}
                  x={x(i)}
                  y={H - (i % 2 ? 4 : 17)}
                  textAnchor="middle"
                >
                  {s.name.split(' ')[0]}
                </text>
              ))}
            </g>
            {MEASURES.map(([k, name], j) => (
              <g key={k}>
                <path
                  d={steps
                    .map((_, i) => `${i ? 'L' : 'M'}${x(i)},${y(v(i, k))}`)
                    .join('')}
                  fill="none"
                  stroke={j ? OTHER : PALETTE[0]}
                  strokeWidth={j ? 1.5 : 2.2}
                />
                {steps.map((s, i) => (
                  <circle
                    key={s.id}
                    cx={x(i)}
                    cy={y(v(i, k))}
                    r={3}
                    fill={j ? OTHER : PALETTE[0]}
                  >
                    <title>{`${name}, ${s.name}: ${pc(v(i, k))}`}</title>
                  </circle>
                ))}
              </g>
            ))}
            <EndLabels
              x={W - r + 6}
              top={top}
              bottom={H - bottom}
              items={MEASURES.map(([k, name], j) => ({
                y: y(v(steps.length - 1, k)),
                label: `${name} ${pc(v(steps.length - 1, k))}`,
                color: j ? undefined : PALETTE[0],
              }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

const sizesOf = ({ evaluation }: SymSummary) =>
  Object.entries(evaluation.cluster_sizes).sort((a, b) => b[1] - a[1])

function ClusterSkyline() {
  const data = useData<SymSummary>(SYM)
  return (
    <Frame data={data}>
      {(s) => {
        const sizes = sizesOf(s)
        const [W, H, m, top, bottom] = [600, 220, 34, 16, 18]
        const yt = niceTicks(sizes[0]?.[1] ?? 1)
        const y = linearScale([0, yt.at(-1)!], [H - bottom, top])
        const bw = (W - m) / sizes.length
        return (
          <Svg
            w={W}
            h={H}
            label="Points in every symbolic cluster, largest first"
          >
            <YAxis y={y} ticks={yt} x0={m} x1={W} format={fmt} />
            <XAxis
              x={(i) => m + (i - 0.5) * bw}
              y={H - 4}
              ticks={[1, 25, 50, 75, 100, 125]
                .filter((i) => i <= sizes.length)
                .map((i) => ({
                  value: i,
                  label: i === 1 ? 'rank 1' : String(i),
                }))}
            />
            {sizes.map(([id, n], i) => (
              <rect
                key={id}
                x={m + i * bw + 0.3}
                width={Math.max(bw - 0.6, 0.6)}
                y={y(n)}
                height={H - bottom - y(n)}
                fill={i ? OTHER : PALETTE[0]}
              >
                <title>{`Cluster ${id}: ${fmt(n)} points`}</title>
              </rect>
            ))}
            <text className="mean-txt-v" x={m + bw + 4} y={y(sizes[0][1]) + 9}>
              {fmt(sizes[0][1])}
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

/** Concepts sorted by their highest lift in any corpus. */
function lifts(rows: Profile[]) {
  const corpora = uniq(rows.map((r) => r.corpus_id)).sort()
  const v = new Map(
    rows.map((r) => [`${r.concept_id}|${r.corpus_id}`, r.rank1_lift]),
  )
  const best = (k: string) =>
    Math.max(...corpora.map((c) => v.get(`${k}|${c}`) ?? 0))
  const concepts = uniq(rows.map((r) => r.concept_id)).sort(
    (a, b) => best(b) - best(a),
  )
  return { corpora, concepts, v }
}

function ConceptLift() {
  const data = useData<Profile[]>('concepts/profiles.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const { corpora, concepts, v } = lifts(rows)
        const max = Math.max(...v.values(), 1)
        const [W, mx, my, ch] = [300, 92, 18, 18]
        const cw = (W - mx) / corpora.length
        return (
          <Svg
            w={W}
            h={my + concepts.length * ch}
            label="How many times chance each concept ranks first in each corpus"
          >
            {corpora.map((c, j) => (
              <text
                key={c}
                className="mean-txt-v"
                x={mx + (j + 0.5) * cw}
                y={11}
                textAnchor="middle"
              >
                {c}
              </text>
            ))}
            {concepts.map((k, i) => (
              <g key={k}>
                <text
                  className="mean-txt-t"
                  x={mx - 6}
                  y={my + (i + 0.5) * ch + 3.5}
                  textAnchor="end"
                >
                  {k}
                </text>
                {corpora.map((c, j) => {
                  const l = v.get(`${k}|${c}`) ?? 0
                  const t = Math.sqrt(l / max)
                  return (
                    <g key={c}>
                      <rect
                        x={mx + j * cw + 1}
                        y={my + i * ch + 1}
                        width={cw - 2}
                        height={ch - 2}
                        fill={seq(t)}
                      >
                        <title>{`${k} · ${c}: ${l.toFixed(2)} × chance`}</title>
                      </rect>
                      <text
                        className="mean-txt-t"
                        x={mx + (j + 0.5) * cw}
                        y={my + (i + 0.5) * ch + 3.5}
                        textAnchor="middle"
                        style={
                          t > 0.6 ? { fill: 'var(--mean-card)' } : undefined
                        }
                      >
                        {l ? l.toFixed(1) : '–'}
                      </text>
                    </g>
                  )
                })}
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
    id: 'txt-ml-research-steps',
    domain: d,
    sources: ['symbolic/research-history.json'],
    title: ({ steps }: Steps) => {
      const k = MEASURES[0][0]
      return `Points in clusters that span books rose from ${pc(steps[0].metrics[k])} to ${pc(steps.at(-1)!.metrics[k])} over ${steps.length} research steps`
    },
    note: 'Share of mapped points per step; higher is better across books, lower for unclustered',
    render: () => <ResearchSteps />,
  },
  {
    id: 'txt-ml-cluster-skyline',
    domain: d,
    sources: ['symbolic/summary.json'],
    size: 'wide',
    title: (s: SymSummary) => {
      const sizes = sizesOf(s)
      return `${sizes.length} clusters; the largest holds ${fmt(sizes[0][1])} of ${fmt(sum(sizes.map(([, n]) => n)))} clustered points`
    },
    note: 'Points per cluster in the symbolic atlas, clusters ranked by size',
    render: () => <ClusterSkyline />,
  },
  {
    id: 'txt-ml-concept-lift',
    domain: d,
    sources: ['concepts/profiles.json'],
    size: 'tall',
    title: (rows: Profile[]) => {
      const [top] = [...rows].sort((a, b) => b.rank1_lift - a.rank1_lift)
      return `“${top.concept_id}” ranks first in ${top.corpus_id} passages ${top.rank1_lift.toFixed(1)} times as often as chance`
    },
    note: 'Times chance (1 in 28) that a concept ranks first for passages in each corpus; rows by highest value',
    render: () => <ConceptLift />,
  },
]
