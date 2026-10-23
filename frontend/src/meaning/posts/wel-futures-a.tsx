/** Talk of the future in the Riksdag: how often, and on which themes. */
import { Frame, OTHER, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Svg, axis, extent, fmt, path, pct, scale } from './wel-kit'

type Trends = {
  themes: { id: string; label_en: string; rows: number[][] }[]
  future_share: [number, number, number, number | null][]
  academic: { future_share: [number, number, number][] }
}

const useTrends = () => useData<Trends>('sweden/futures/trends.json')

/** Column of `rows` with matches per thousand words of all speeches. */
const PER_1000 = 7

/** Short theme names for a panel heading, one word so each fits over its panel on a phone;
 * label_en where none is set. */
const SHORT: Record<string, string> = {
  technology: 'Technology',
  collective: 'Collective',
  career: 'Careers',
  environment: 'Environment',
  crisis: 'Crisis',
  utopia: 'Utopias',
  alternatives: 'Alternatives',
  security: 'Security',
  culture: 'Culture',
}

function FutureShare() {
  return (
    <Frame data={useTrends()}>
      {(d) => {
        // Year and share, from either file's rows.
        const pairs = (rows: (number | null)[][]) =>
          rows.map((r) => [r[0]!, r[1]!])
        const series = [
          { name: 'Riksdag', rows: pairs(d.future_share), focal: true },
          {
            name: 'Theses',
            rows: pairs(d.academic.future_share),
            focal: false,
          },
        ]
        const all = series.flatMap((s) => s.rows)
        const ax = axis(
          all.map((r) => r[1] * 100),
          [176, 12],
        )
        const [y0, y1] = extent(all.map((r) => r[0]))
        const x = scale([y0, y1], [30, 246])
        return (
          <Svg label="Share of Riksdag speeches and of student theses that speak of the future, %">
            <YAxis
              y={ax.y}
              ticks={ax.ticks}
              x0={30}
              x1={246}
              format={(v) => `${v}%`}
            />
            {series.map((s) => (
              <path
                key={s.name}
                d={path(s.rows.map((r) => [x(r[0]), ax.y(r[1] * 100)]))}
                fill="none"
                stroke={focal(s.focal)}
                strokeWidth={s.focal ? 2.2 : 1.4}
              />
            ))}
            <EndLabels
              x={250}
              top={12}
              bottom={176}
              items={series
                .filter((s) => s.rows.length)
                .map((s) => ({
                  y: ax.y(s.rows.at(-1)![1] * 100),
                  label: s.name,
                  color: s.focal ? undefined : 'var(--mean-muted)',
                }))}
            />
            <XAxis
              x={x}
              y={194}
              ticks={[y0, 2005, 2015, y1]
                .filter((v, i, a) => a.indexOf(v) === i && v >= y0 && v <= y1)
                .map((v) => ({ value: v, label: String(v) }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

/** Each theme's mentions per thousand words by year, largest in the latest year first. */
const themes = (d: Trends) =>
  d.themes
    .map((t) => ({
      id: t.id,
      name: SHORT[t.id] ?? t.label_en,
      years: t.rows.map((r) => r[0]),
      v: t.rows.map((r) => r[PER_1000]),
    }))
    .filter((t) => t.v.length)
    .sort((a, b) => b.v.at(-1)! - a.v.at(-1)!)

function ThemeMultiples() {
  return (
    <Frame data={useTrends()}>
      {(d) => {
        const ts = themes(d)
        // One y scale for all nine panels, so their heights compare.
        const top = Math.max(...ts.flatMap((t) => t.v))
        return (
          <Svg
            w={600}
            h={250}
            label="Nine small multiples, one per future theme, on a shared scale of mentions per thousand words"
          >
            {ts.map((t, k) => {
              const ox = (k % 3) * 200
              const oy = Math.floor(k / 3) * 80
              const x = scale([0, t.v.length - 1], [ox + 4, ox + 150])
              const y = scale([0, top], [oy + 70, oy + 18])
              return (
                <g key={t.id}>
                  <text x={ox + 4} y={oy + 11} className="mean-wel-name">
                    {t.name}
                  </text>
                  <line
                    className="mean-wel-base"
                    x1={ox + 4}
                    x2={ox + 150}
                    y1={oy + 70}
                    y2={oy + 70}
                  />
                  <path
                    d={path(t.v.map((v, i) => [x(i), y(v)]))}
                    fill="none"
                    stroke={k === 0 ? focal(true) : OTHER}
                    strokeWidth={1.6}
                  />
                  <text x={ox + 154} y={y(t.v.at(-1)!) + 4}>
                    {fmt(t.v.at(-1)!, 1)}
                  </text>
                </g>
              )
            })}
            <text x={4} y={246}>
              {ts[0]?.years[0]}–{ts[0]?.years.at(-1)}
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-future-share',
    domain: 'sweden',
    sources: ['sweden/futures/trends.json'],
    title: (d: Trends) => {
      const r = d.future_share.at(-1)
      return r
        ? `In ${r[0]}, ${pct(r[1] * 100, 0)} of Riksdag speeches used future-marker words`
        : 'Talk of the future in the Riksdag'
    },
    note: 'Share of speeches, and of thesis abstracts, matching a future marker. Sources: Riksdagen, DiVA',
    render: () => <FutureShare />,
  },
  {
    id: 'wel-future-multiples',
    domain: 'sweden',
    sources: ['sweden/futures/trends.json'],
    size: 'wide',
    title: (d: Trends) => {
      const t = themes(d)[0]
      return t
        ? `${t.name} was the most mentioned future theme in the Riksdag in ${t.years.at(-1)}`
        : 'Future themes in the Riksdag'
    },
    note: 'Theme mentions per 1,000 words of all speeches, by year; one scale for all panels. Source: Riksdagen',
    render: () => <ThemeMultiples />,
  },
]
