/** Jobs: the ad market over time, from market.json's monthly, daily and archive counts. */
import { color, focal, Frame, useData, type Post } from '../kit'
import { YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  compact,
  D,
  fieldName,
  fmt,
  linePath,
  MARKET,
  sum,
  Svg,
  XLabels,
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
        const fields = topFields(m, 12)
        const W = 300,
          rowH = 510 / fields.length
        return (
          <Svg
            w={W}
            h={510}
            label="Monthly ads in the twelve largest fields, each on its own scale"
          >
            {fields.map((f, j) => {
              const rows = m.monthly[f.id] ?? []
              const y0 = j * rowH + rowH - 3
              const x = linearScale([0, rows.length - 1], [4, 244])
              const y = linearScale(
                [0, Math.max(1, ...rows.map((r) => r[1]))],
                [y0, j * rowH + 16],
              )
              const pts = rows.map(
                (r, i) => [x(i), y(r[1])] as [number, number],
              )
              return (
                <g key={f.id}>
                  <title>{fieldName(f.name)}</title>
                  <path
                    d={`${linePath(pts)}L244,${y0}L4,${y0}Z`}
                    fill={focal(j === 0)}
                    opacity={0.3}
                  />
                  <path
                    d={linePath(pts)}
                    fill="none"
                    stroke={focal(j === 0)}
                    strokeWidth={1.25}
                  />
                  <text
                    className={j === 0 ? 'mean-job-on' : 'mean-job-v'}
                    x={4}
                    y={j * rowH + 11}
                  >
                    {fieldName(f.name)}
                  </text>
                  <text
                    className="mean-job-v"
                    x={W - 2}
                    y={y0 - 2}
                    textAnchor="end"
                  >
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

/** Weekday ads per day, the mean over the days read whole. */
const weekdayMean = (m: Market) => {
  const days = (m.daily?.all ?? []).filter(
    (r) => ![0, 6].includes(new Date(`${r[0]}T12:00`).getDay()),
  )
  return days.length ? sum(days.map((r) => r[1])) / days.length : 0
}

function Daily() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = m.daily?.all ?? []
        const ticks = niceTicks(Math.max(1, ...rows.map((r) => r[1])))
        const W = 300,
          H = 220,
          L = 34,
          B = 196
        const y = linearScale([0, ticks.at(-1)!], [B, 14])
        const bw = (W - L) / Math.max(1, rows.length)
        const day = (d: string) =>
          new Date(`${d}T12:00`).toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
          })
        return (
          <Svg w={W} h={H} label="New job ads per day, latest days">
            <YAxis ticks={ticks} y={y} x0={L} x1={W} format={compact} />
            {rows.map((r, i) => (
              <g key={r[0]}>
                <title>{`${r[0]}: ${fmt(r[1])} ads, ${fmt(r[2])} vacancies`}</title>
                <rect
                  x={L + i * bw + bw * 0.15}
                  y={y(r[1])}
                  width={bw * 0.7}
                  height={B - y(r[1])}
                  fill="var(--mean-ink)"
                />
                <text
                  className="mean-job-v"
                  x={L + i * bw + bw / 2}
                  y={y(r[1]) - 4}
                  textAnchor="middle"
                >
                  {fmt(r[1])}
                </text>
              </g>
            ))}
            <XLabels
              y={H - 4}
              items={rows.map((r, i) => ({
                x: L + i * bw + bw / 2,
                label: day(r[0]),
              }))}
            />
          </Svg>
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
    title: 'Monthly job ads in the twelve largest fields',
    note: 'Each line on its own scale, from 2020; the number is the latest month; Arbetsförmedlingen',
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
    title: (m: Market) =>
      `About ${fmt(Math.round(weekdayMean(m) / 100) * 100)} new ads a weekday in the latest days`,
    note: "New ads per publication day from JobTech's daily stream, days read in full; preliminary",
    render: () => <Daily />,
  },
]
