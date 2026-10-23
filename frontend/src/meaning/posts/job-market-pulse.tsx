/** Jobs: the ad market over time, from market.json's monthly, daily and archive counts. */
import { color, focal, Frame, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  compact,
  D,
  fieldName,
  fmt,
  Legend,
  linePath,
  MARKET,
  sum,
  Svg,
  YTicks,
  type Market,
} from './job-kit'

/** The fields with the most ads over all months, biggest first. */
const topFields = (m: Market, n: number) =>
  m.fields
    .map((f) => ({
      ...f,
      total: sum((m.monthly[f.id] ?? []).map((r) => r[1])),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)

function Sparks() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const fields = topFields(m, 21)
        const W = 400,
          rowH = 36
        return (
          <Svg
            w={W}
            h={fields.length * rowH}
            label="Sparkline per occupation field"
          >
            {fields.map((f, j) => {
              const rows = m.monthly[f.id] ?? []
              const x = linearScale([0, rows.length - 1], [8, 300])
              const y = linearScale(
                [0, Math.max(...rows.map((r) => r[1]))],
                [j * rowH + rowH - 4, j * rowH + 4],
              )
              const pts = rows.map(
                (r, i) => [x(i), y(r[1])] as [number, number],
              )
              return (
                <g key={f.id}>
                  <title>{fieldName(f.name)}</title>
                  <path
                    d={`${linePath(pts)}L300,${j * rowH + rowH - 4}L8,${j * rowH + rowH - 4}Z`}
                    fill={focal(j === 0)}
                    opacity={0.35}
                  />
                  <path
                    d={linePath(pts)}
                    fill="none"
                    stroke={focal(j === 0)}
                    strokeWidth={1.5}
                  />
                  <text
                    x={10}
                    y={j * rowH + 12}
                    fontSize={10}
                    fontWeight={j === 0 ? 700 : 500}
                    stroke="var(--paper)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {fieldName(f.name)}
                  </text>
                  <circle
                    cx={pts.at(-1)?.[0]}
                    cy={pts.at(-1)?.[1]}
                    r={2.5}
                    fill="var(--ink)"
                  />
                  <text x={392} y={j * rowH + rowH / 2 + 4} textAnchor="end">
                    {compact(rows.at(-1)?.[1] ?? 0)}
                  </text>
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Frame>
  )
}

function Archives() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const a = m.archives
        const W = 400,
          H = 360,
          B = 330
        const ticks = niceTicks(Math.max(...a.map((r) => r.ads)))
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const bw = (W - 40) / a.length
        return (
          <Svg w={W} h={H} label="Ads per source archive">
            <YTicks ticks={ticks} y={y} x0={38} x1={W} />
            {a.map((r, i) => (
              <g key={r.archive}>
                <rect
                  x={40 + i * bw + 3}
                  y={y(r.ads)}
                  width={bw - 6}
                  height={B - y(r.ads)}
                  rx={3}
                  fill={color(i)}
                >
                  <title>{`${r.archive}: ${fmt(r.ads)} ads`}</title>
                </rect>
                <text
                  x={40 + i * bw + bw / 2}
                  y={B + 14}
                  textAnchor="middle"
                  fontSize={8}
                >
                  {r.archive.replace('2026-', '')}
                </text>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

function Daily() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = m.daily?.all ?? []
        const max = Math.max(1, ...rows.map((r) => r[2]))
        const W = 400,
          H = 360,
          cx = W / 2,
          cy = 190
        return (
          <>
            <Svg w={W} h={H} label="Ads and vacancies per day, latest days">
              {rows.map((r, i) => {
                const a0 = (i / rows.length) * 2 * Math.PI
                const a1 = ((i + 0.85) / rows.length) * 2 * Math.PI
                const R = (v: number) => 40 + (v / max) * 120
                const q = (rad: number, a: number) => [
                  cx + rad * Math.sin(a),
                  cy - rad * Math.cos(a),
                ]
                const p = (rad: number, a: number) => q(rad, a).join(',')
                const [tx, ty] = q(R(r[2]) + 14, (a0 + a1) / 2)
                const wedge = (v: number) =>
                  `M${p(40, a0)}L${p(R(v), a0)}A${R(v)},${R(v)} 0 0 1 ${p(R(v), a1)}L${p(40, a1)}Z`
                return (
                  <g key={r[0]}>
                    <path d={wedge(r[2])} fill={color(1)} opacity={0.55} />
                    <path d={wedge(r[1])} fill={color(0)}>
                      <title>{`${r[0]}: ${fmt(r[1])} ads, ${fmt(r[2])} vacancies`}</title>
                    </path>
                    <text x={tx} y={ty} textAnchor="middle" fontSize={10}>
                      {r[0].slice(5)}
                    </text>
                  </g>
                )
              })}
            </Svg>
            <Legend
              items={[
                ['ads', color(0)],
                ['vacancies', color(1)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-sparks',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'tall',
    render: () => <Sparks />,
  },
  {
    id: 'job-archives',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <Archives />,
  },
  {
    id: 'job-daily-rose',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <Daily />,
  },
]
