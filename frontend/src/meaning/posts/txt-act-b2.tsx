/** AI Act duties, actors, cross-references and outside signals: heatmap, donut, flows, arcs, lines. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Kpi, Svg, XGrid, clip, count, palette } from './txt-kit'

type Obligation = {
  actor_id: string
  requirement_type: string
  risk_class_id: string
  applies_from: string
}
type Actor = {
  actor_id: string
  label_en: string
  articles_mentioning: number
  articles_with_duty_sentences: number
}
const OBL = 'ai-act/obligations.json'
const d = 'ai-act'

/** Three columns of nodes (actor, risk class, date), flows sized by obligation count. */
function DutyFlows() {
  const data = useData<Obligation[]>(OBL)
  return (
    <Frame data={data}>
      {(rows) => {
        const stages: ((o: Obligation) => string)[] = [
          (o) => o.actor_id,
          (o) => o.risk_class_id,
          (o) => o.applies_from,
        ]
        const [W, H, gap, nw] = [600, 300, 6, 10]
        const k = (H - gap * 8) / rows.length
        const cols = stages.map((f, s) => {
          const keys = [...count(rows, f)].sort((a, b) => b[1] - a[1])
          let y = 0
          return new Map(
            keys.map(([key, n]) => [
              key,
              {
                y: (y += n * k + gap) - n * k - gap,
                h: n * k,
                x: 4 + (s * (W - nw - 8)) / 2,
                out: 0,
                in: 0,
              },
            ]),
          )
        })
        const nodeColor = palette([...cols[0].keys()])
        const links = [0, 1].flatMap((s) =>
          [
            ...count(
              rows,
              (o) => `${stages[s](o)}|${stages[s + 1](o)}|${o.actor_id}`,
            ),
          ].map(([key, n]) => ({ s, key: key.split('|'), n })),
        )
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Obligations flowing from actor to risk class to application date"
            >
              {links.map(({ s, key: [a, b, who], n }, i) => {
                const A = cols[s].get(a)!
                const B = cols[s + 1].get(b)!
                const [y0, y1, w] = [
                  A.y + A.out + (n * k) / 2,
                  B.y + B.in + (n * k) / 2,
                  n * k,
                ]
                A.out += w
                B.in += w
                const [x0, x1] = [A.x + nw, B.x]
                const mxp = (x0 + x1) / 2
                return (
                  <path
                    key={i}
                    d={`M${x0},${y0}C${mxp},${y0} ${mxp},${y1} ${x1},${y1}`}
                    stroke={nodeColor.get(who)}
                    strokeWidth={Math.max(w, 0.5)}
                    strokeOpacity={0.55}
                    fill="none"
                  >
                    <title>{`${a} → ${b}: ${n}`}</title>
                  </path>
                )
              })}
              {cols.flatMap((m, s) =>
                [...m].map(([key, n]) => (
                  <g key={`${s}${key}`}>
                    <rect
                      x={n.x}
                      y={n.y}
                      width={nw}
                      height={n.h}
                      fill={s ? 'var(--ink-2)' : nodeColor.get(key)}
                    />
                    <text
                      className="mean-txt-t"
                      x={s === 2 ? n.x - 3 : n.x + nw + 3}
                      y={n.y + n.h / 2 + 3}
                      textAnchor={s === 2 ? 'end' : 'start'}
                    >
                      {key}
                    </text>
                  </g>
                )),
              )}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}
const DutyTotal = () => {
  const data = useData<Obligation[]>(OBL)
  return (
    <Frame data={data}>
      {(rows) => <Kpi value={rows.length} unit="obligations" />}
    </Frame>
  )
}
/** Short names, so the longest actor fits beside its row. */
const SHORT: Record<string, string> = {
  gpai_provider: 'GPAI model provider',
  authorised_representative: 'Authorised rep.',
  market_surveillance_authority: 'Market surveillance',
  national_competent_authority: 'National authority',
}
function ActorDumbbell() {
  const data = useData<Actor[]>('ai-act/actors.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const as = [...rows].sort(
          (a, b) => b.articles_mentioning - a.articles_mentioning,
        )
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
    id: 'txt-act-duty-flows',
    domain: d,
    sources: ['ai-act/obligations.json'],
    size: 'wide',
    render: () => <DutyFlows />,
  },
  {
    id: 'txt-act-duty-total',
    domain: d,
    sources: ['ai-act/obligations.json'],
    render: () => <DutyTotal />,
  },
  {
    id: 'txt-act-actor-dumbbell',
    domain: d,
    sources: ['ai-act/actors.json'],
    title: (rows: Actor[]) => {
      const [a] = [...rows].sort(
        (p, q) => q.articles_mentioning - p.articles_mentioning,
      )
      return `The ${a.label_en.toLowerCase()} is named in ${a.articles_mentioning} articles and given duties in ${a.articles_with_duty_sentences}`
    },
    note: 'Articles of the AI Act that name each actor, and those that give it a duty',
    render: () => <ActorDumbbell />,
  },
]
