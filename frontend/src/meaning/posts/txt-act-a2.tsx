/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { Frame, PALETTE, useData, type Post } from '../kit'
import { XAxis, YAxis } from '../axes'
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
/** Articles applying by each date, cumulative: [date, articles so far]. */
const steps = (rows: Article[]) => {
  const dates = uniq(rows.flatMap((a) => a.applies_from ?? [])).sort()
  return dates.map(
    (d) =>
      [
        d,
        rows.filter((a) => a.applies_from && a.applies_from <= d).length,
      ] as const,
  )
}
const month = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

function ApplyStep() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => {
        const cum = steps(rows)
        const [W, H, m, b] = [600, 220, 34, 18]
        const t0 = year(cum[0][0])
        const t1 = year(String(+cum.at(-1)![0].slice(0, 4) + 1))
        const x = linearScale([t0, t1], [m, W - 30])
        const ticks = niceTicks(rows.length)
        const y = linearScale([0, ticks.at(-1)!], [H - b, 10])
        const pts: [number, number][] = [[m, y(0)]]
        for (const [d, n] of cum)
          pts.push([x(Date.parse(d)), pts.at(-1)![1]], [x(Date.parse(d)), y(n)])
        pts.push([W - 30, pts.at(-1)![1]])
        const yrs = uniq([
          ...cum.map(([d]) => d.slice(0, 4)),
          String(new Date(t1).getFullYear()),
        ])
        // A date followed within a month by another step is labelled at that later step.
        const named = cum.filter(
          ([d], i) =>
            i === cum.length - 1 ||
            Date.parse(cum[i + 1][0]) - Date.parse(d) > 31 * 864e5,
        )
        return (
          <Svg
            w={W}
            h={H}
            label="AI Act articles that apply, cumulative, by date"
          >
            <YAxis y={y} ticks={ticks} x0={m} x1={W - 30} />
            <XAxis
              x={x}
              y={H - 4}
              ticks={yrs.map((yr) => ({ value: year(yr), label: yr }))}
            />
            <path
              d={line(pts)}
              fill="none"
              stroke={PALETTE[0]}
              strokeWidth={2}
            />
            {named.map(([d, n]) => (
              <g key={d}>
                <circle
                  cx={x(Date.parse(d))}
                  cy={y(n)}
                  r={3}
                  fill={PALETTE[0]}
                />
                <text
                  className="mean-txt-v"
                  x={x(Date.parse(d)) + 5}
                  y={y(n) - 5}
                >
                  {n}
                  <title>{`${month(d)}: ${n} articles`}</title>
                </text>
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
    title: (rows: Article[]) => {
      const cum = steps(rows)
      const rise = cum.map(([, n], i) => n - (cum[i - 1]?.[1] ?? 0))
      // The largest single step: the general date of application.
      const big = cum[rise.indexOf(Math.max(...rise))]
      return `${big[1]} of ${rows.length} articles apply by ${month(big[0])}, all by ${month(cum.at(-1)![0])}`
    },
    note: 'Articles in application, cumulative, by the date the Act sets for each',
    size: 'wide',
    render: () => <ApplyStep />,
  },
]
