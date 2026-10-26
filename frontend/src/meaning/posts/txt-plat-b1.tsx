/** Swedish statutes: how many were issued per year, and how many are repealed. */
import { Frame, OTHER, PALETTE, shade, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis, ticksBetween } from '../axes'
import { Stacked } from '../../charts/Compare'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, fmt, heading, line, sum, usable } from './txt-kit'
import { l } from '../../i18n'

type Sfs = {
  kinds: { kind: string; documents: number; repealed: number }[]
  years: (Record<string, number> & { year: number })[]
  lengths: { kind: string; up_to: number | null; passages: number }[]
  largest: { sfs: string; title: string; sections: number }[]
  tests: Record<string, number>
}
const SFS = 'sfs/overview.json'
const d = 'platform'

/** Statute kinds bottom to top, with English and Swedish names and one stable colour each. */
const KINDS: [string, readonly [string, string], string][] = [
  ['förordning', ['Ordinances', 'Förordningar'], shade(1, 3)],
  ['lag', ['Acts', 'Lagar'], PALETTE[0]],
  ['other', ['Other', 'Övriga'], shade(2, 3)],
]
const kindLabel = (kind: string) => {
  const name = KINDS.find(([q]) => q === kind)?.[1]
  return name ? l(...name) : kind
}
const total = (r: Sfs['years'][number]) => sum(KINDS.map(([k]) => r[k] ?? 0))

function SfsStream() {
  const data = usable(useData<Sfs>(SFS), SFS, (s) => s.years.length > 1)
  return (
    <Frame data={data}>
      {({ years }) => {
        const [W, H, left, r, top, bottom] = [600, 220, 34, 84, 10, 18]
        const y0 = years[0].year
        const y1 = years.at(-1)!.year
        // Every year on the axis. The file counts statutes by the year they were issued and
        // lists only years with at least one, so a year it leaves out had none in the collection.
        const at = new Map(years.map((row) => [row.year, row]))
        const all = Array.from({ length: y1 - y0 + 1 }, (_, i) =>
          at.get(y0 + i),
        )
        const x = linearScale([y0, y1], [left, W - r])
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
          <Svg
            w={W}
            h={H}
            label={l(
              'Swedish statutes per year by kind, stacked',
              'Svenska författningar per år och slag, staplade',
            )}
          >
            <YAxis y={y} ticks={yt} x0={left} x1={W - r} format={fmt} />
            <XAxis
              x={x}
              y={H - 4}
              ticks={ticksBetween(y0, y1, 6).map((t) => ({
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
                <title>{l(...name)}</title>
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
                  label: l(...name),
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
  const data = usable(useData<Sfs>(SFS), SFS, (s) => s.kinds.length)
  return (
    <Frame data={data}>
      {({ kinds }) => (
        <div className="mean-bars">
          <Stacked
            label={l(
              'Swedish statutes in force and repealed, by kind',
              'Svenska författningar i kraft och upphävda, per slag',
            )}
            format={fmt}
            parts={[
              { label: l('In force', 'I kraft'), colour: PALETTE[0] },
              { label: l('Repealed', 'Upphävda'), colour: OTHER },
            ]}
            rows={[...kinds]
              .sort((a, b) => b.documents - a.documents)
              .map((k) => ({
                key: k.kind,
                label: kindLabel(k.kind),
                values: [k.documents - k.repealed, k.repealed],
                text: `${fmt(k.documents - k.repealed)} ${l('of', 'av')} ${fmt(k.documents)}`,
              }))}
          />
        </div>
      )}
    </Frame>
  )
}
export const posts: Post[] = [
  {
    id: 'txt-plat-sfs-stream',
    domain: d,
    sources: ['sfs/overview.json'],
    title: heading(({ years }: Sfs) => {
      const peak = [...years].sort((a, b) => total(b) - total(a))[0]
      return l(
        `Statutes in the collection peak in ${peak.year}, with ${fmt(total(peak))} issued that year`,
        `Flest författningar i samlingen kom ${peak.year}, då ${fmt(total(peak))} utfärdades`,
      )
    }),
    note: [
      "Swedish statutes (SFS) in Riksdagen's open data by year issued, including those since repealed",
      'Svenska författningar (SFS) i riksdagens öppna data efter utfärdandeår, även de som sedan upphävts',
    ],
    size: 'wide',
    render: () => <SfsStream />,
  },
  {
    id: 'txt-plat-sfs-units',
    domain: d,
    sources: ['sfs/overview.json'],
    title: heading(({ kinds }: Sfs) => {
      const n = sum(kinds.map((k) => k.documents))
      const gone = sum(kinds.map((k) => k.repealed))
      return n
        ? l(
            `${Math.round((gone / n) * 100)}% of the ${fmt(n)} statutes in the collection are repealed`,
            `${Math.round((gone / n) * 100)} % av samlingens ${fmt(n)} författningar är upphävda`,
          )
        : ''
    }),
    note: [
      "Swedish statutes (SFS) in Riksdagen's open data, by kind; statutes still in force at the row end",
      'Svenska författningar (SFS) i riksdagens öppna data, per slag; de som fortfarande gäller står vid radens slut',
    ],
    size: 'tall',
    render: () => <SfsUnits />,
  },
]
