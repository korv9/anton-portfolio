/** Swedish statutes, idea lineage, compliance review and delivery: streams, units, funnels, bubbles. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Legend, Svg, fmt, line, palette, sum, ticksIn, uniq } from './txt-kit'

type Sfs = {
  kinds: { kind: string; documents: number; repealed: number }[]
  years: (Record<string, number> & { year: number })[]
  lengths: { kind: string; up_to: number | null; passages: number }[]
  largest: { sfs: string; title: string; sections: number }[]
  tests: Record<string, number>
}
type Lineage = {
  events: {
    id: string
    title: string
    type: string
    importance: string
    occurred_on?: string
    created_at: string
  }[]
}
const SFS = 'sfs/overview.json'
const KINDS = ['lag', 'förordning', 'other']
const MODES = ['stacked', 'stream', 'share'] as const
const d = 'platform'

function SfsStream() {
  const data = useData<Sfs>(SFS)
  const [mode, setMode] = useState<(typeof MODES)[number]>('stream')
  return (
    <Frame data={data}>
      {({ years }) => {
        const [W, H, m] = [600, 280, 30]
        const tot = years.map((r) => sum(KINDS.map((k) => r[k] ?? 0)))
        const max = Math.max(...tot)
        const x = linearScale([years[0].year, years.at(-1)!.year], [m, W - 4])
        const y = linearScale(
          mode === 'share'
            ? [0, 1]
            : mode === 'stream'
              ? [-max / 2, max / 2]
              : [0, max],
          [H - 14, 6],
        )
        const base = (i: number) => (mode === 'stream' ? -tot[i] / 2 : 0)
        const norm = (i: number) => (mode === 'share' ? tot[i] || 1 : 1)
        const layer = (upto: number) =>
          years.map(
            (r, i) =>
              [
                x(r.year),
                y(
                  (base(i) + sum(KINDS.slice(0, upto).map((k) => r[k] ?? 0))) /
                    norm(i),
                ),
              ] as [number, number],
          )
        return (
          <>
            <Slicer
              label="Layout"
              options={MODES}
              value={mode}
              onChange={setMode}
            />
            <Svg w={W} h={H} label="Swedish statutes issued per year by kind">
              {ticksIn([years[0].year, years.at(-1)!.year], 8).map((t) => (
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
              {KINDS.map((k, j) => (
                <path
                  key={k}
                  d={`${line(layer(j + 1))}${line(layer(j).reverse()).replace('M', 'L')}Z`}
                  fill={color(j)}
                >
                  <title>{k}</title>
                </path>
              ))}
            </Svg>
            <Legend items={KINDS.map((k, j) => [k, color(j)])} />
          </>
        )
      }}
    </Frame>
  )
}
/** One dot per hundred documents; filled dots are in force, rings are repealed. */
function SfsUnits() {
  const data = useData<Sfs>(SFS)
  return (
    <Frame data={data}>
      {({ kinds }) => {
        const per = 100
        const cols = 12
        const s = 400 / cols
        let row = 0
        return (
          <>
            <Svg
              w={400}
              h={420}
              label="Statute documents by kind, one dot per hundred"
            >
              {kinds.map((k, j) => {
                const n = Math.round(k.documents / per)
                const rep = Math.round(k.repealed / per)
                const top = row
                row += Math.ceil(n / cols) + 0.6
                return Array.from({ length: n }, (_, i) => (
                  <circle
                    key={`${k.kind}${i}`}
                    cx={(i % cols) * s + s / 2}
                    cy={(top + Math.floor(i / cols)) * s + s / 2}
                    r={s * 0.38}
                    fill={i < n - rep ? color(j) : 'none'}
                    stroke={color(j)}
                    strokeWidth={1.5}
                  >
                    <title>{`${k.kind}: ${fmt(k.documents)}, ${fmt(k.repealed)} repealed`}</title>
                  </circle>
                ))
              })}
            </Svg>
            <Legend items={kinds.map((k, j) => [k.kind, color(j)])} />
          </>
        )
      }}
    </Frame>
  )
}
function LineageUnits() {
  const data = useData<Lineage>('idea-lineage/events.json')
  return (
    <Frame data={data}>
      {({ events }) => {
        const day = (e: Lineage['events'][number]) =>
          e.occurred_on ?? e.created_at.slice(0, 10)
        const days = uniq(events.map(day)).sort()
        const types = palette(uniq(events.map((e) => e.type)))
        const cw = 300 / days.length
        const stack = new Map<string, number>()
        return (
          <>
            <Svg w={300} h={300} label="Idea lineage events per day, by type">
              {days.map((dy, i) => (
                <text
                  key={dy}
                  className="mean-txt-t"
                  x={(i + 0.5) * cw}
                  y={296}
                  textAnchor="middle"
                >
                  {dy}
                </text>
              ))}
              {events.map((e) => {
                const i = days.indexOf(day(e))
                const k = stack.get(day(e)) ?? 0
                stack.set(day(e), k + 1)
                const big = e.importance === 'major'
                return (
                  <rect
                    key={e.id}
                    x={(i + 0.5) * cw - (big ? 22 : 16)}
                    y={270 - k * 28 - (big ? 26 : 20)}
                    width={big ? 44 : 32}
                    height={big ? 26 : 20}
                    rx={6}
                    fill={types.get(e.type)}
                  >
                    <title>{e.title}</title>
                  </rect>
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
    id: 'txt-plat-sfs-stream',
    domain: d,
    size: 'wide',
    render: () => <SfsStream />,
  },
  {
    id: 'txt-plat-sfs-units',
    domain: d,
    size: 'tall',
    render: () => <SfsUnits />,
  },
  { id: 'txt-plat-lineage-units', domain: d, render: () => <LineageUnits /> },
]
