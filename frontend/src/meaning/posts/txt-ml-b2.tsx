/** Symbolic atlas research steps, and the concept layer's lift per corpus. */
import { Frame, OTHER, PALETTE, seq, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { EndLabels, YAxis } from '../axes'
import { Svg, heading, uniq, usable } from './txt-kit'

type Steps = {
  steps: {
    id: string
    name: string
    metrics: Record<string, number>
    documents?: number
  }[]
}
type Profile = { concept_id: string; corpus_id: string; rank1_lift: number }
const STEPS = 'symbolic/research-history.json'
const PROFILES = 'concepts/profiles.json'
const pc = (v: number) => `${Math.round(v * 100)}%`
const d = 'ml'

/** Two shares over the steps; the first is focal. Higher is better for the first. */
const MEASURES: [string, string][] = [
  ['cross_book_occurrence_share', 'Across books'],
  ['noise_share', 'Unclustered'],
]
/** A step's value, or null where the step did not record it: a gap, never a zero. */
const value = (s: Steps['steps'][number], k: string) =>
  Number.isFinite(s.metrics?.[k]) ? s.metrics[k] : null

function ResearchSteps() {
  const data = usable(useData<Steps>(STEPS), STEPS, (d) => d.steps.length > 1)
  return (
    <Frame data={data}>
      {({ steps }) => {
        const [W, H, l, r, top, bottom] = [300, 230, 34, 96, 10, 32]
        const x = linearScale([0, steps.length - 1], [l + 22, W - r - 8])
        const y = linearScale([0, 1], [H - bottom, top])
        const last = steps.at(-1)!
        return (
          <Svg
            w={W}
            h={H}
            label="Symbolic atlas measures across the research steps"
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
            {MEASURES.map(([k, name], j) => {
              // A missing value breaks the line rather than dropping it to zero.
              const path = steps
                .map((s, i) => {
                  const v = value(s, k)
                  const prev = i ? value(steps[i - 1], k) : null
                  return v === null
                    ? ''
                    : `${prev === null ? 'M' : 'L'}${x(i)},${y(v)}`
                })
                .join('')
              return (
                <g key={k}>
                  <path
                    d={path}
                    fill="none"
                    stroke={j ? OTHER : PALETTE[0]}
                    strokeWidth={j ? 1.5 : 2.2}
                  />
                  {steps.map((s, i) => {
                    const v = value(s, k)
                    return v === null ? null : (
                      <circle
                        key={s.id}
                        cx={x(i)}
                        cy={y(v)}
                        r={3}
                        fill={j ? OTHER : PALETTE[0]}
                      >
                        <title>{`${name}, ${s.name}: ${pc(v)}`}</title>
                      </circle>
                    )
                  })}
                </g>
              )
            })}
            <EndLabels
              x={W - r + 6}
              top={top}
              bottom={H - bottom}
              items={MEASURES.flatMap(([k, name], j) => {
                const v = value(last, k)
                return v === null
                  ? []
                  : [
                      {
                        y: y(v),
                        label: `${name} ${pc(v)}`,
                        color: j ? undefined : PALETTE[0],
                      },
                    ]
              })}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

/** Concepts sorted by their highest lift in any corpus; a missing cell stays missing. */
function lifts(rows: Profile[]) {
  const corpora = uniq(rows.map((r) => r.corpus_id)).sort()
  const v = new Map(
    rows
      .filter((r) => Number.isFinite(r.rank1_lift))
      .map((r) => [`${r.concept_id}|${r.corpus_id}`, r.rank1_lift]),
  )
  const best = (k: string) =>
    Math.max(...corpora.map((c) => v.get(`${k}|${c}`) ?? -1))
  const concepts = uniq(rows.map((r) => r.concept_id)).sort(
    (a, b) => best(b) - best(a),
  )
  return { corpora, concepts, v }
}

function ConceptLift() {
  const data = usable(
    useData<Profile[]>(PROFILES),
    PROFILES,
    (r) => lifts(r).v.size,
  )
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
                  const l = v.get(`${k}|${c}`)
                  const t = l === undefined ? 0 : Math.sqrt(l / max)
                  return (
                    <g key={c}>
                      <rect
                        x={mx + j * cw + 1}
                        y={my + i * ch + 1}
                        width={cw - 2}
                        height={ch - 2}
                        fill={l === undefined ? 'none' : seq(t)}
                        stroke={l === undefined ? 'var(--mean-grid)' : 'none'}
                      >
                        <title>
                          {l === undefined
                            ? `${k} · ${c}: no data`
                            : `${k} · ${c}: ${l.toFixed(2)} × chance`}
                        </title>
                      </rect>
                      {l !== undefined && (
                        <text
                          className="mean-txt-t"
                          x={mx + (j + 0.5) * cw}
                          y={my + (i + 0.5) * ch + 3.5}
                          textAnchor="middle"
                          style={
                            t > 0.6 ? { fill: 'var(--mean-card)' } : undefined
                          }
                        >
                          {l.toFixed(1)}
                        </text>
                      )}
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

export const posts: Post[] = [
  {
    id: 'txt-ml-research-steps',
    domain: d,
    sources: ['symbolic/research-history.json'],
    title: heading(({ steps }: Steps) => {
      const k = MEASURES[0][0]
      const [a, b] = [value(steps[0], k), value(steps.at(-1)!, k)]
      if (a === null || b === null || steps.length < 2) return ''
      const books = steps.at(-1)!.documents
      return `Points in clusters that span books: ${pc(a)} at the first step, ${pc(b)} at the last${books ? `, which used a larger corpus of ${books} books` : ''}`
    }),
    note: 'Share of mapped points per research step; higher is better across books, lower for unclustered. The last step also changed the corpus, so the ends are not a like-for-like comparison',
    render: () => <ResearchSteps />,
  },
  {
    id: 'txt-ml-concept-lift',
    domain: d,
    sources: ['concepts/profiles.json'],
    size: 'tall',
    title: heading((rows: Profile[]) => {
      const [top] = [...rows]
        .filter((r) => Number.isFinite(r.rank1_lift))
        .sort((a, b) => b.rank1_lift - a.rank1_lift)
      const n = uniq(rows.map((r) => r.concept_id)).length
      return `“${top.concept_id}” ranks first in ${top.corpus_id} passages ${top.rank1_lift.toFixed(1)} times as often as chance (1 in ${n} concepts)`
    }),
    note: 'Times chance that a concept ranks first for passages in each corpus; rows by highest value, empty cells have no data',
    render: () => <ConceptLift />,
  },
]
