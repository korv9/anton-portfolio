/** Swedish statutes, idea lineage, compliance review and delivery: streams, units, funnels, bubbles. */
import { Frame, OTHER, PALETTE, shade, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Stacked } from '../../charts/Compare'
import { linearScale, niceTicks } from '../../charts/scales'
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
const d = 'platform'

/** Statute kinds bottom to top, with English names and one stable colour each. */
const KINDS: [string, string, string][] = [
  ['förordning', 'Ordinances', shade(1, 3)],
  ['lag', 'Acts', PALETTE[0]],
  ['other', 'Other', shade(2, 3)],
]
const total = (r: Sfs['years'][number]) => sum(KINDS.map(([k]) => r[k] ?? 0))

function SfsStream() {
  const data = useData<Sfs>(SFS)
  return (
    <Frame data={data}>
      {({ years }) => {
        const [W, H, l, r, top, bottom] = [600, 220, 34, 84, 10, 18]
        const y0 = years[0].year
        const y1 = years.at(-1)!.year
        // Every year on the axis; a year with no statute in the data counts as zero.
        const at = new Map(years.map((row) => [row.year, row]))
        const all = Array.from({ length: y1 - y0 + 1 }, (_, i) =>
          at.get(y0 + i),
        )
        const x = linearScale([y0, y1], [l, W - r])
        const yt = niceTicks(Math.max(...years.map(total)))
        const y = linearScale([0, yt.at(-1)!], [H - bottom, top])
        const layer = (upto: number) =>
          all.map(
            (row, i) =>
              [
                x(y0 + i),
                y(
                  row ? sum(KINDS.slice(0, upto).map(([k]) => row[k] ?? 0)) : 0,
                ),
              ] as [number, number],
          )
        const last = all.at(-1)
        return (
          <Svg w={W} h={H} label="Swedish statutes per year by kind, stacked">
            <YAxis y={y} ticks={yt} x0={l} x1={W - r} format={fmt} />
            <XAxis
              x={x}
              y={H - 4}
              ticks={ticksIn([y0, y1], 6).map((t) => ({
                value: t,
                label: String(t),
              }))}
            />
            {KINDS.map(([k, name, c], j) => (
              <path
                key={k}
                d={`${line(layer(j + 1))}${line(layer(j).reverse()).replace('M', 'L')}Z`}
                fill={c}
              >
                <title>{name}</title>
              </path>
            ))}
            <EndLabels
              x={W - r + 6}
              top={top}
              bottom={H - bottom}
              items={KINDS.map(([k, name, c], j) => {
                const lo = last
                  ? sum(KINDS.slice(0, j).map(([q]) => last[q] ?? 0))
                  : 0
                return {
                  y: y(lo + (last?.[k] ?? 0) / 2),
                  label: name,
                  color: j === 1 ? c : undefined,
                }
              })}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}
/** In force and repealed per kind, as 100 % rows with the counts written. */
function SfsUnits() {
  const data = useData<Sfs>(SFS)
  return (
    <Frame data={data}>
      {({ kinds }) => (
        <div className="mean-bars">
          <Stacked
            label="Swedish statutes in force and repealed, by kind"
            format={fmt}
            parts={[
              { label: 'In force', colour: PALETTE[0] },
              { label: 'Repealed', colour: OTHER },
            ]}
            rows={[...kinds]
              .sort((a, b) => b.documents - a.documents)
              .map((k) => ({
                key: k.kind,
                label: KINDS.find(([q]) => q === k.kind)?.[1] ?? k.kind,
                values: [k.documents - k.repealed, k.repealed],
                text: `${fmt(k.documents - k.repealed)} of ${fmt(k.documents)}`,
              }))}
          />
        </div>
      )}
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
    sources: ['sfs/overview.json'],
    title: ({ years }: Sfs) => {
      const peak = [...years].sort((a, b) => total(b) - total(a))[0]
      return `Statutes in the collection peak in ${peak.year}, with ${fmt(total(peak))} issued that year`
    },
    note: "Swedish statutes (SFS) in Riksdagen's open data by year issued, including those since repealed",
    size: 'wide',
    render: () => <SfsStream />,
  },
  {
    id: 'txt-plat-sfs-units',
    domain: d,
    sources: ['sfs/overview.json'],
    title: ({ kinds }: Sfs) => {
      const n = sum(kinds.map((k) => k.documents))
      const gone = sum(kinds.map((k) => k.repealed))
      return `${Math.round((gone / n) * 100)}% of the ${fmt(n)} statutes in the collection are repealed`
    },
    note: "Swedish statutes (SFS) in Riksdagen's open data, by kind; statutes still in force at the row end",
    size: 'tall',
    render: () => <SfsUnits />,
  },
  {
    id: 'txt-plat-lineage-units',
    domain: d,
    sources: ['idea-lineage/events.json'],
    render: () => <LineageUnits />,
  },
]
