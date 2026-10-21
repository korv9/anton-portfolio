/** Swedish statutes, idea lineage, compliance review and delivery: streams, units, funnels, bubbles. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, fmt, sum, ticksIn, uniq } from './txt-kit'

type Sfs = {
  kinds: { kind: string; documents: number; repealed: number }[]
  years: (Record<string, number> & { year: number })[]
  lengths: { kind: string; up_to: number | null; passages: number }[]
  largest: { sfs: string; title: string; sections: number }[]
  tests: Record<string, number>
}
type Progress = {
  approved_gold_records: number
  cohort: Record<string, unknown>
  review: Record<string, number>
}
const SFS = 'sfs/overview.json'
const KINDS = ['lag', 'förordning', 'other']
const d = 'platform'

function SfsRepealed() {
  const data = useData<Sfs>(SFS)
  return (
    <Frame data={data}>
      {({ years }) => {
        const rows = years
          .map((r) => ({
            year: r.year,
            n: sum(KINDS.map((k) => r[k] ?? 0)),
            rep: r.repealed ?? 0,
          }))
          .filter((r) => r.n)
        const [W, H, m] = [400, 400, 30]
        const x = linearScale([rows[0].year, rows.at(-1)!.year], [m, W - 6])
        const y = linearScale([0, 1], [H - 14, 6])
        const r = linearScale(
          [0, Math.sqrt(Math.max(...rows.map((d) => d.n)))],
          [1, 9],
        )
        return (
          <Svg w={W} h={H} label="Share of each year's statutes since repealed">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  className="mean-txt-grid"
                  x1={m}
                  x2={W}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="mean-txt-t"
                  x={m - 3}
                  y={y(t) + 3}
                  textAnchor="end"
                >
                  {t * 100}%
                </text>
              </g>
            ))}
            {ticksIn([rows[0].year, rows.at(-1)!.year], 5).map((t) => (
              <text
                key={t}
                className="mean-txt-t"
                x={x(t)}
                y={H - 2}
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {rows.map((d) => (
              <circle
                key={d.year}
                cx={x(d.year)}
                cy={y(d.rep / d.n)}
                r={r(Math.sqrt(d.n))}
                fill={color(d.year % 6)}
                fillOpacity={0.6}
              >
                <title>{`${d.year}: ${d.rep}/${d.n}`}</title>
              </circle>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function ComplianceFunnel() {
  const data = useData<Progress>('compliance/progress.json')
  return (
    <Frame data={data}>
      {(p) => {
        const steps: [string, number][] = [
          ['eligible population', Number(p.cohort.eligible_population_count)],
          ['selected', Number(p.cohort.selected_count)],
          ...Object.entries(p.review).map(
            ([k, v]) => [k.replace(/_/g, ' '), v] as [string, number],
          ),
          ['approved gold records', p.approved_gold_records],
        ]
        const [W, H, m] = [400, 400, 120]
        const max = Math.log10(Math.max(...steps.map((s) => s[1]), 10))
        const x = (v: number) => m + ((W - m - 50) * Math.log10(v + 1)) / max
        const rh = H / steps.length
        return (
          <Svg w={W} h={H} label="Compliance review funnel on a log scale">
            {steps.map(([k, v], i) => (
              <g key={k}>
                <text
                  className="mean-txt-t"
                  x={m - 4}
                  y={(i + 0.5) * rh + 3}
                  textAnchor="end"
                >
                  {k}
                </text>
                <rect
                  x={m}
                  y={i * rh + 4}
                  width={Math.max(x(v) - m, 2)}
                  height={rh - 8}
                  rx={4}
                  fill={color(i)}
                />
                <text
                  x={Math.max(x(v), m + 2) + 4}
                  y={(i + 0.5) * rh + 5}
                  fontSize={14}
                  fontWeight={600}
                  fill="var(--ink)"
                >
                  {fmt(v)}
                </text>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function SfsLengths() {
  const data = useData<Sfs>(SFS)
  const [kind, setKind] = useState('paragraph')
  return (
    <Frame data={data}>
      {({ lengths }) => {
        const rows = lengths.filter((l) => l.kind === kind)
        const [W, H, m] = [400, 400, 40]
        const yt = niceTicks(Math.max(...rows.map((r) => r.passages), 1))
        const y = linearScale([0, yt.at(-1)!], [H - 14, 6])
        const bw = (W - m) / Math.max(rows.length, 1)
        return (
          <>
            <Slicer
              label="Passage kind"
              options={uniq(lengths.map((l) => l.kind))}
              value={kind}
              onChange={setKind}
            />
            <Svg w={W} h={H} label="Statute passages by length in characters">
              {yt.map((t) => (
                <g key={t}>
                  <line
                    className="mean-txt-grid"
                    x1={m}
                    x2={W}
                    y1={y(t)}
                    y2={y(t)}
                  />
                  <text
                    className="mean-txt-t"
                    x={m - 3}
                    y={y(t) + 3}
                    textAnchor="end"
                  >
                    {fmt(t)}
                  </text>
                </g>
              ))}
              {rows.map((r, i) => (
                <g key={i}>
                  <rect
                    x={m + i * bw + 2}
                    width={bw - 4}
                    y={y(r.passages)}
                    height={H - 14 - y(r.passages)}
                    rx={4}
                    fill={color(i)}
                  >
                    <title>{`≤ ${r.up_to ?? '∞'}: ${fmt(r.passages)}`}</title>
                  </rect>
                  <text
                    className="mean-txt-t"
                    x={m + (i + 0.5) * bw}
                    y={H - 2}
                    textAnchor="middle"
                  >
                    {r.up_to ? `≤${fmt(r.up_to)}` : '∞'}
                  </text>
                </g>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'txt-plat-sfs-repealed', domain: d, render: () => <SfsRepealed /> },
  {
    id: 'txt-plat-compliance-funnel',
    domain: d,
    render: () => <ComplianceFunnel />,
  },
  { id: 'txt-plat-sfs-lengths', domain: d, render: () => <SfsLengths /> },
]
