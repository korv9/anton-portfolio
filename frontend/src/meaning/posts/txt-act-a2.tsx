/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { Frame, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Kpi, Legend, Svg, fmt, line, palette, sum, uniq } from './txt-kit'

type Article = {
  article_number: string
  article_sort: number
  chapter: string
  char_count: number
  change_type: string
  applies_from: string | null
  refers_to: string[]
  actors: string[]
}
const ARTICLES = 'ai-act/articles.json'
const year = (d: string) => Date.parse(`${d.slice(0, 4)}-01-01`)
function YAxis({
  ticks,
  y,
  x0,
  x1,
}: {
  ticks: number[]
  y: (v: number) => number
  x0: number
  x1: number
}) {
  return ticks.map((t) => (
    <g key={t}>
      <line className="mean-txt-grid" x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
      <text className="mean-txt-t" x={x0 - 3} y={y(t) + 3} textAnchor="end">
        {fmt(t)}
      </text>
    </g>
  ))
}
const d = 'ai-act'

function AppliesWaffle() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => {
        const arts = [...rows].sort(
          (a, b) =>
            (a.applies_from ?? '').localeCompare(b.applies_from ?? '') ||
            a.article_sort - b.article_sort,
        )
        const cols = palette(uniq(arts.map((a) => a.applies_from ?? 'none')))
        const n = Math.ceil(Math.sqrt(arts.length))
        const s = 400 / n
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Waffle of AI Act articles by date of application"
            >
              {arts.map((a, i) => (
                <rect
                  key={a.article_number}
                  x={(i % n) * s + 2}
                  y={Math.floor(i / n) * s + 2}
                  width={s - 4}
                  height={s - 4}
                  rx={s / 5}
                  fill={cols.get(a.applies_from ?? 'none')}
                >
                  <title>{`${a.article_number}: ${a.applies_from ?? ''}`}</title>
                </rect>
              ))}
            </Svg>
            <Legend items={[...cols]} />
          </>
        )
      }}
    </Frame>
  )
}
function Characters() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => (
        <Kpi
          value={fmt(sum(rows.map((a) => a.char_count)))}
          unit="characters"
        />
      )}
    </Frame>
  )
}
function ApplyStep() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => {
        const arts = rows.filter((a) => a.applies_from)
        const dates = uniq(arts.map((a) => a.applies_from!)).sort()
        const types = uniq(arts.map((a) => a.change_type)).sort()
        const [W, H, m] = [600, 280, 30]
        const t0 = year(dates[0])
        const t1 = year(dates.at(-1)!) + 365 * 864e5
        const x = linearScale([t0, t1], [m, W])
        const ticks = niceTicks(arts.length)
        const y = linearScale([0, ticks.at(-1)!], [H - 14, 6])
        const cum = (d: string, upto: number) =>
          arts.filter(
            (a) => a.applies_from! <= d && types.indexOf(a.change_type) <= upto,
          ).length
        const top = (k: number) =>
          dates.flatMap(
            (d, i) =>
              [
                [x(Date.parse(d)), y(i ? cum(dates[i - 1], k) : 0)],
                [x(Date.parse(d)), y(cum(d, k))],
              ] as [number, number][],
          )
        const yrs = uniq(
          dates
            .map((d) => d.slice(0, 4))
            .concat(String(new Date(t1).getFullYear())),
        )
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Articles of the AI Act in force over time, stacked by change"
            >
              <YAxis ticks={ticks} y={y} x0={m} x1={W} />
              {yrs.map((yr) => (
                <text
                  key={yr}
                  className="mean-txt-t"
                  x={x(year(yr))}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {yr}
                </text>
              ))}
              {types
                .map((t, k) => {
                  const hi = [...top(k), [W, top(k).at(-1)![1]]] as [
                    number,
                    number,
                  ][]
                  const lo = k
                    ? ([...top(k - 1), [W, top(k - 1).at(-1)![1]]] as [
                        number,
                        number,
                      ][])
                    : hi.map(([px]) => [px, y(0)] as [number, number])
                  return (
                    <path
                      key={t}
                      d={`${line(hi)}${line([...lo].reverse()).replace('M', 'L')}Z`}
                      fill={color(k)}
                    />
                  )
                })
                .reverse()}
            </Svg>
            <Legend items={types.map((t, k) => [t, color(k)])} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-applies-waffle',
    domain: d,
    sources: ['ai-act/articles.json'],
    render: () => <AppliesWaffle />,
  },
  {
    id: 'txt-act-characters',
    domain: d,
    sources: ['ai-act/articles.json'],
    render: () => <Characters />,
  },
  {
    id: 'txt-act-apply-step',
    domain: d,
    sources: ['ai-act/articles.json'],
    size: 'wide',
    render: () => <ApplyStep />,
  },
]
