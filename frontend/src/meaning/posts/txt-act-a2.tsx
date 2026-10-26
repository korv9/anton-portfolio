/** AI Act application dates: how many articles apply by each date, cumulative. */
import { Frame, PALETTE, useData, type Post } from '../kit'
import { XAxis, YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, day, heading, line, uniq, usable } from './txt-kit'
import { l } from '../../i18n'

type Article = { article_number: string; applies_from: string | null }
const ARTICLES = 'ai-act/articles.json'
const year = (d: string) => Date.parse(`${d.slice(0, 4)}-01-01`)
const d = 'ai-act'

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

function ApplyStep() {
  const data = usable(
    useData<Article[]>(ARTICLES),
    ARTICLES,
    (r) => steps(r).length,
  )
  return (
    <Frame data={data}>
      {(rows) => {
        const cum = steps(rows)
        const [W, H, m, b, r] = [600, 220, 34, 18, 30]
        const t0 = year(cum[0][0])
        const t1 = year(String(+cum.at(-1)![0].slice(0, 4) + 1))
        const x = linearScale([t0, t1], [m, W - r])
        const ticks = niceTicks(rows.length)
        const y = linearScale([0, ticks.at(-1)!], [H - b, 10])
        const pts: [number, number][] = [[m, y(0)]]
        for (const [d, n] of cum)
          pts.push([x(Date.parse(d)), pts.at(-1)![1]], [x(Date.parse(d)), y(n)])
        pts.push([W - r, pts.at(-1)![1]])
        const yrs = uniq([
          ...cum.map(([d]) => d.slice(0, 4)),
          String(new Date(t1).getUTCFullYear()),
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
            label={l(
              'AI Act articles that apply, cumulative, by date',
              'Tillämpliga artiklar i AI-förordningen, kumulativt, per datum',
            )}
          >
            <YAxis y={y} ticks={ticks} x0={m} x1={W - r} />
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
                  <title>
                    {l(`${day(d)}: ${n} articles`, `${day(d)}: ${n} artiklar`)}
                  </title>
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
    id: 'txt-act-apply-step',
    domain: d,
    sources: ['ai-act/articles.json'],
    size: 'wide',
    title: heading((rows: Article[]) => {
      const cum = steps(rows)
      const rise = cum.map(([, n], i) => n - (cum[i - 1]?.[1] ?? 0))
      // The largest single step: the general date of application.
      const big = cum[rise.indexOf(Math.max(...rise))]
      const [end, n] = cum.at(-1)!
      return l(
        `${big[1]} of ${rows.length} articles apply by ${day(big[0], false)}, ${n === rows.length ? 'all' : n} by ${day(end, false)}`,
        `${big[1]} av ${rows.length} artiklar gäller från ${day(big[0], false)}, ${n === rows.length ? 'alla' : n} från ${day(end, false)}`,
      )
    }),
    note: [
      'Articles in application, cumulative, by the date the Act sets for each',
      'Artiklar som tillämpas, kumulativt, efter det datum förordningen anger för var och en',
    ],
    render: () => <ApplyStep />,
  },
]
