/** How Riksdag AI speeches weigh paired words per AI Act phase. */
import { l } from '../../i18n'
import { focal, Frame, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { line, signed } from './pol-kit'
import { XLabels } from './job-kit'

type Framing = {
  pair_id: string
  party: string
  period: string
  ai_speeches: number
  speeches_a: number
  speeches_b: number
  speeches_both: number
  balance: number | null
}[]
type Summary = {
  pairs: { pair_id: string; concept_a: string; concept_b: string }[]
  phases: { id: string; from?: string; until?: string }[]
}
const FRAMING = 'ai-act/politics/framing.json'
const SUMMARY = 'ai-act/politics/summary.json'
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

/** Swedish for the words the pair ids are built from (summary.json's label_sv). */
const WORD_SV: Record<string, string> = {
  innovation: 'innovation',
  safety: 'säkerhet',
  privacy: 'integritet',
  security: 'säkerhetspolitik',
  regulation: 'reglering',
  competitiveness: 'konkurrenskraft',
}
const words = (id: string) => id.split('_').map((w) => l(w, WORD_SV[w] ?? w))
/** AI speeches in a phase, all parties: the same for every pair. */
const phaseSpeeches = (rows: Framing, phase: string) =>
  allParties(rows).find((r) => r.period === phase)?.ai_speeches
/** The fewest speeches naming either word of the focal pair before a reversal is claimed. */
const MIN_SPEECHES = 20
const yearOf = (date?: string) => date?.slice(0, 4)
/** A phase by the years it spans: 'Until 2021', '2021–24', 'Since 2024'. */
const phaseName = (p: { from?: string; until?: string }) =>
  p.from && p.until
    ? `${yearOf(p.from)}–${yearOf(p.until)?.slice(2)}`
    : p.until
      ? l(`Until ${yearOf(p.until)}`, `Till ${yearOf(p.until)}`)
      : l(`Since ${yearOf(p.from)}`, `Från ${yearOf(p.from)}`)

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
                aria-label={l(
                  'Balance between paired words in Riksdag AI speeches, per AI Act phase',
                  'Balansen mellan ordpar i riksdagens AI-anföranden, per fas av AI-förordningen',
                )}
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
                            label: l(`${a} vs ${b}`, `${a} mot ${b}`),
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
                <XLabels
                  y={233}
                  items={phases.map((ph, i) => ({
                    x: x(i),
                    label: `n ${phaseSpeeches(rows, ph.id) ?? '?'}`,
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
  const row = (period: string) =>
    allParties(rows).find((r) => r.pair_id === top && r.period === period)
  // Speeches naming either word of the pair.
  const n = (r?: Framing[number]) =>
    r ? r.speeches_a + r.speeches_b - r.speeches_both : 0
  const [pre, mid] = [row('before_proposal'), row('negotiation')]
  const [before, during] = [pre?.balance, mid?.balance]
  if (
    !top ||
    before == null ||
    during == null ||
    before * during >= 0 ||
    Math.min(n(pre), n(mid)) < MIN_SPEECHES
  )
    return l(
      'Paired words in Riksdag AI speeches, before and after the AI Act',
      'Ordpar i riksdagens AI-anföranden, före och efter AI-förordningen',
    )
  const [a, b] = words(top)
  const [first, then] = before > 0 ? [a, b] : [b, a]
  return l(
    `AI speeches in the Riksdag named ${first} over ${then} until the AI Act proposal (n ${n(pre)}), then ${then} (n ${n(mid)})`,
    `AI-anförandena i riksdagen nämnde ${first} före ${then} fram till förslaget till AI-förordningen (n ${n(pre)}), sedan ${then} (n ${n(mid)})`,
  )
}

export const posts: Post[] = [
  {
    id: 'pol-ai-framing-dumbbell',
    domain: 'ai-act',
    sources: ['ai-act/politics/framing.json', 'ai-act/politics/summary.json'],
    size: 'wide',
    title: framingTitle,
    note: [
      '+1: AI speeches name only the first word of a pair, −1: only the second; all parties; n: AI speeches in the phase. Source: Riksdagen',
      '+1: AI-anförandena nämner bara ordparets första ord, −1: bara det andra; alla partier; n: AI-anföranden i fasen. Källa: Riksdagen',
    ],
    render: () => <FramingSlope />,
  },
]
