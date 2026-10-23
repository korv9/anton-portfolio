/** How Riksdag AI speeches weigh paired words per AI Act phase, and the Riksdag's topic eras. */
import { cellInk, focal, Frame, seq, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { line, pct, signed } from './pol-kit'
import { XLabels } from './job-kit'

type Framing = {
  pair_id: string
  party: string
  period: string
  ai_speeches: number
  balance: number | null
}[]
type Summary = {
  pairs: { pair_id: string; concept_a: string; concept_b: string }[]
  phases: { id: string; from?: string; until?: string }[]
}
type Eras = {
  clusters: {
    sessions: string[]
    top_topics: [number, string, number, number][]
  }[]
  topic_shares: {
    sessions: string[]
    topics: [number, string][]
    rows: number[][]
  }
}

const FRAMING = 'ai-act/politics/framing.json'
const SUMMARY = 'ai-act/politics/summary.json'
const ERAS = 'clusters/riksdag-eras.json'

/** All parties together, per phase; a phase with no speech naming either word has no balance. */
const allParties = (rows: Framing) =>
  rows.filter((r) => r.party === 'ALL' && r.period !== 'all')

/** The pair whose balance moved most between phases: the focal line. */
function swings(rows: Framing) {
  const by = new Map<string, number[]>()
  for (const r of allParties(rows))
    if (r.balance != null)
      by.set(r.pair_id, [...(by.get(r.pair_id) ?? []), r.balance])
  return [...by]
    .map(([id, v]) => ({ id, swing: Math.max(...v) - Math.min(...v) }))
    .sort((a, b) => b.swing - a.swing)
}

const words = (id: string) => id.split('_')
const yearOf = (date?: string) => date?.slice(0, 4)
/** A phase by the years it spans: 'Until 2021', '2021–24', 'Since 2024'. */
const phaseName = (p: { from?: string; until?: string }) =>
  p.from && p.until
    ? `${yearOf(p.from)}–${yearOf(p.until)?.slice(2)}`
    : p.until
      ? `Until ${yearOf(p.until)}`
      : `Since ${yearOf(p.from)}`
/** A topic by its top word; a short one, such as 'eu', is an acronym. */
const word = (label: string) => {
  const w = label.split(' / ')[0]
  return w.length <= 3 ? w.toUpperCase() : w
}

function FramingSlope() {
  const framing = useData<Framing>(FRAMING)
  const summary = useData<Summary>(SUMMARY)
  return (
    <Frame data={framing}>
      {(rows) => (
        <Frame data={summary}>
          {(s) => {
            const phases = s.phases
            const top = swings(rows)[0]?.id
            const L = 40,
              R = 350,
              T = 14,
              B = 186
            const x = linearScale([0, phases.length - 1], [L + 30, R - 30])
            const y = linearScale([-0.5, 0.5], [B, T])
            const at = (pair: string, phase: string) =>
              allParties(rows).find(
                (r) => r.pair_id === pair && r.period === phase,
              )?.balance ?? null
            const pairs = [...s.pairs].sort(
              (a, b) => +(a.pair_id === top) - +(b.pair_id === top),
            )
            const lastPhase = phases.at(-1)?.id ?? ''
            return (
              <svg
                viewBox="0 0 600 220"
                role="img"
                aria-label="Balance between paired words in Riksdag AI speeches, per AI Act phase"
              >
                <YAxis
                  y={y}
                  ticks={[-0.5, 0, 0.5]}
                  x0={L}
                  x1={R}
                  format={(v) => (v ? signed(v) : '0')}
                />
                {pairs.map((p) => {
                  const on = p.pair_id === top
                  const pts = phases.flatMap((ph, i) => {
                    const v = at(p.pair_id, ph.id)
                    return v == null ? [] : [[x(i), y(v)] as [number, number]]
                  })
                  return (
                    <g key={p.pair_id}>
                      <path
                        d={line(pts)}
                        fill="none"
                        stroke={focal(on)}
                        strokeWidth={on ? 2.5 : 1.5}
                      />
                      {pts.map(([cx, cy]) => (
                        <circle
                          key={cx}
                          cx={cx}
                          cy={cy}
                          r={on ? 3.5 : 2.5}
                          fill={focal(on)}
                        />
                      ))}
                    </g>
                  )
                })}
                <EndLabels
                  x={R - 22}
                  top={T}
                  bottom={B}
                  items={[...pairs].reverse().flatMap((p) => {
                    const v = at(p.pair_id, lastPhase)
                    const [a, b] = words(p.pair_id)
                    return v == null
                      ? []
                      : [
                          {
                            y: y(v),
                            label: `${a} vs ${b}`,
                            color:
                              p.pair_id === top
                                ? focal(true)
                                : 'var(--mean-muted)',
                          },
                        ]
                  })}
                />
                <XLabels
                  y={216}
                  items={phases.map((ph, i) => ({
                    x: x(i),
                    label: phaseName(ph),
                  }))}
                />
              </svg>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function framingTitle(rows: Framing) {
  const top = swings(rows)[0]?.id
  const v = (period: string) =>
    allParties(rows).find((r) => r.pair_id === top && r.period === period)
      ?.balance
  const before = v('before_proposal')
  const during = v('negotiation')
  if (!top || before == null || during == null || before * during >= 0)
    return 'Paired words in Riksdag AI speeches, before and after the AI Act'
  const [a, b] = words(top)
  const [first, then] = before > 0 ? [a, b] : [b, a]
  return `Until the AI Act proposal, Riksdag AI speeches named ${first} over ${then}; then ${then} led`
}

/** The six eras, each with its own most over-represented topic, as rows of a topic × era grid. */
function eraGrid(d: Eras) {
  const { sessions, topics, rows } = d.topic_shares
  const col = new Map(topics.map(([id], i) => [id, i]))
  const eras = d.clusters.map((c) => ({
    name: `${c.sessions[0].slice(0, 4)}–${c.sessions.at(-1)!.slice(-2)}`,
    rows: c.sessions.map((s) => rows[sessions.indexOf(s)]).filter(Boolean),
  }))
  const ids = [...new Set(d.clusters.map((c) => c.top_topics[0]?.[0]))].filter(
    (id) => col.has(id),
  )
  const label = new Map(topics.map(([id, l]) => [id, word(l)]))
  const cells = ids.map((id) =>
    eras.map(
      (e) =>
        e.rows.reduce((a, r) => a + r[col.get(id)!], 0) / (e.rows.length || 1),
    ),
  )
  return { eras, ids, label, cells }
}

function EraHeat() {
  return (
    <Frame data={useData<Eras>(ERAS)}>
      {(d) => {
        const { eras, ids, label, cells } = eraGrid(d)
        if (!ids.length || !eras.length) return null
        const max = Math.max(...cells.flat())
        const L = 90,
          T = 22,
          W = (590 - L) / eras.length,
          H = (214 - T) / ids.length
        return (
          <svg
            viewBox="0 0 600 220"
            role="img"
            aria-label="Share of debate words per topic in each Riksdag era"
          >
            <g className="mean-axis">
              {eras.map((e, j) => (
                <text
                  key={e.name}
                  x={L + W * (j + 0.5)}
                  y={T - 8}
                  textAnchor="middle"
                >
                  {e.name}
                </text>
              ))}
              {ids.map((id, i) => (
                <text
                  key={id}
                  x={L - 6}
                  y={T + H * (i + 0.5)}
                  dy="0.35em"
                  textAnchor="end"
                >
                  {label.get(id)}
                </text>
              ))}
            </g>
            {ids.map((id, i) =>
              cells[i].map((v, j) => {
                const t = v / max
                const hot = v === max
                return (
                  <g key={`${id}-${j}`}>
                    <rect
                      x={L + W * j + 1}
                      y={T + H * i + 1}
                      width={W - 2}
                      height={H - 2}
                      fill={seq(t)}
                      stroke={hot ? focal(true) : undefined}
                      strokeWidth={hot ? 2 : undefined}
                    >
                      <title>{`${label.get(id)}, ${eras[j].name}: ${pct(v * 100)}`}</title>
                    </rect>
                    <text
                      x={L + W * (j + 0.5)}
                      y={T + H * (i + 0.5)}
                      dy="0.35em"
                      textAnchor="middle"
                      className="mean-pol-t"
                      style={cellInk(t)}
                    >
                      {pct(v * 100, 0)}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-ai-framing-dumbbell',
    domain: 'ai-act',
    sources: ['ai-act/politics/framing.json', 'ai-act/politics/summary.json'],
    size: 'wide',
    title: framingTitle,
    note: '+1: AI speeches name only the first word of a pair, −1: only the second; all parties, 115 to 372 AI speeches per phase. Source: Riksdagen',
    render: () => <FramingSlope />,
  },
  {
    id: 'pol-riksdag-eras-heat',
    domain: 'politics',
    sources: ['clusters/riksdag-eras.json'],
    size: 'wide',
    title: 'Riksdag debates fall into six eras, each with a topic of its own',
    note: 'Share of debate words per topic, mean of each era’s sessions; the six topics that most set an era apart, of 25, each named by its top Swedish word',
    render: () => <EraHeat />,
  },
]
