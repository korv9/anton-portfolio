/** Futures talk in the Riksdag and the size of what Sweden measures. */
import { Frame, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  YAxis,
  extent,
  niceMax,
  path,
  scale,
} from './wel-kit'

type Trends = {
  themes: { id: string; label_en: string; rows: number[][] }[]
  future_share: [number, number, number, number | null][]
  academic: { future_share: [number, number, number][] }
}

const useTrends = () => useData<Trends>('sweden/futures/trends.json')

const PER_1000 = 7

function ThemeStream() {
  const data = useTrends()
  return (
    <Frame data={data}>
      {(d) => {
        const years = d.themes[0].rows.map((r) => r[0])
        const vals = d.themes.map((t) =>
          years.map((y) => t.rows.find((r) => r[0] === y)?.[PER_1000] ?? 0),
        )
        const sums = years.map((_, i) => vals.reduce((s, v) => s + v[i], 0))
        const max = Math.max(...sums)
        const x = scale([0, years.length - 1], [10, 790])
        const y = scale([-max / 2, max / 2], [390, 10])
        let base = sums.map((s) => -s / 2)
        return (
          <>
            <Svg
              w={800}
              h={400}
              label="Streamgraph of future themes per thousand words in Riksdag speeches"
            >
              {vals.map((v, k) => {
                const lo = base
                const hi = lo.map((b, i) => b + v[i])
                base = hi
                const top = years.map(
                  (_, i) => [x(i), y(hi[i])] as [number, number],
                )
                const bottom = years
                  .map((_, i) => [x(i), y(lo[i])] as [number, number])
                  .reverse()
                return (
                  <path
                    key={k}
                    d={`${path(top)}L${path(bottom).slice(1)}Z`}
                    fill={color(k)}
                    stroke="var(--paper)"
                    strokeWidth={0.6}
                  />
                )
              })}
              <XTicks
                values={years.map((v, i) => (i % 5 ? '' : v))}
                x={x}
                y={398}
              />
            </Svg>
            <Legend items={d.themes.map((t) => t.id)} />
          </>
        )
      }}
    </Frame>
  )
}

function FutureShare() {
  const data = useTrends()
  return (
    <Frame data={data}>
      {(d) => {
        const all = [
          ...d.future_share.map((r) => r[1]),
          ...d.academic.future_share.map((r) => r[1]),
        ]
        const [y0, y1] = extent(
          [...d.future_share, ...d.academic.future_share].map((r) => r[0]),
        )
        const top = niceMax(Math.max(...all) * 100)
        const x = scale([y0, y1], [36, 390])
        const y = scale([0, top], [370, 20])
        const line = (rows: (number | null)[][]) =>
          path(rows.map((r) => [x(r[0]!), y(r[1]! * 100)]))
        return (
          <>
            <Svg label="Share of texts speaking of the future">
              <YAxis max={top} x0={36} x1={390} y0={370} y1={20} />
              <path
                d={line(d.future_share)}
                fill="none"
                stroke={color(0)}
                strokeWidth={3}
              />
              <path
                d={line(d.academic.future_share)}
                fill="none"
                stroke={color(1)}
                strokeWidth={3}
                strokeDasharray="6 4"
              />
              <XTicks values={[y0, y1]} x={(i) => (i ? 370 : 56)} y={392} />
            </Svg>
            <Legend items={['Riksdag %', 'theses %']} />
          </>
        )
      }}
    </Frame>
  )
}

function ThemeMultiples() {
  const data = useTrends()
  return (
    <Frame data={data}>
      {(d) => (
        <Svg label="Nine small multiples, one per future theme">
          {d.themes.map((t, k) => {
            const ox = (k % 3) * 133
            const oy = Math.floor(k / 3) * 133
            const v = t.rows.map((r) => r[PER_1000])
            const x = scale([0, v.length - 1], [ox + 8, ox + 125])
            const y = scale([0, Math.max(...v)], [oy + 120, oy + 30])
            const d0 = path(v.map((p, i) => [x(i), y(p)]))
            return (
              <g key={t.id}>
                <rect
                  x={ox + 3}
                  y={oy + 3}
                  width={127}
                  height={127}
                  rx={10}
                  fill="var(--wash)"
                />
                <path
                  d={`${d0}L${x(v.length - 1)},${oy + 120}L${x(0)},${oy + 120}Z`}
                  fill={color(k)}
                  opacity={0.5}
                />
                <path d={d0} fill="none" stroke={color(k)} strokeWidth={1.6} />
                <text x={ox + 10} y={oy + 20}>
                  {t.id}
                </text>
              </g>
            )
          })}
        </Svg>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-future-stream',
    domain: 'sweden',
    size: 'wide',
    render: () => <ThemeStream />,
  },
  { id: 'wel-future-share', domain: 'sweden', render: () => <FutureShare /> },
  {
    id: 'wel-future-multiples',
    domain: 'sweden',
    render: () => <ThemeMultiples />,
  },
]
