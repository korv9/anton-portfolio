/** Jobs: the ad market over time, from market.json's monthly, daily and archive counts. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'
import {
  bandPath,
  compact,
  D,
  fieldName,
  fmt,
  Legend,
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

function MonthlyLine() {
  const data = useData<Market>(MARKET)
  const [field, setField] = useState('All')
  return (
    <Frame data={data}>
      {(m) => {
        const tops = topFields(m, 7)
        const id = tops.find((f) => fieldName(f.name) === field)?.id ?? 'all'
        const rows = m.monthly[id] ?? []
        const W = 800,
          H = 330,
          L = 44,
          B = 300
        const x = linearScale([0, rows.length - 1], [L, W - 8])
        const ticks = niceTicks(Math.max(...rows.map((r) => r[2])))
        const y = linearScale([0, ticks.at(-1)!], [B, 12])
        const ads = rows.map((r, i) => [x(i), y(r[1])] as [number, number])
        const vac = rows.map((r, i) => [x(i), y(r[2])] as [number, number])
        return (
          <>
            <Slicer
              label="Field"
              options={['All', ...tops.map((f) => fieldName(f.name))]}
              value={field}
              onChange={setField}
            />
            <Svg w={W} h={H} label="Job ads and vacancies per month">
              <YTicks ticks={ticks} y={y} x0={L} x1={W - 8} />
              <path d={bandPath(vac, ads)} fill={color(3)} opacity={0.5} />
              <path
                d={linePath(vac)}
                fill="none"
                stroke={color(1)}
                strokeWidth={2}
              />
              <path
                d={linePath(ads)}
                fill="none"
                stroke={color(0)}
                strokeWidth={2.5}
              />
              <XLabels
                y={H - 12}
                items={yearTicks(rows.map((r) => r[0])).map((t) => ({
                  x: x(t.index),
                  label: t.label,
                }))}
              />
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

function Stream() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const fields = topFields(m, 12)
        const months = (m.monthly.all ?? []).map((r) => r[0])
        const series = fields.map(
          (f) => new Map((m.monthly[f.id] ?? []).map((r) => [r[0], r[1]])),
        )
        const totals = months.map((mo) =>
          sum(series.map((s) => s.get(mo) ?? 0)),
        )
        const W = 800,
          H = 360
        const x = linearScale([0, months.length - 1], [0, W])
        const y = linearScale([0, Math.max(...totals)], [0, H - 30])
        let base = totals.map((t) => (H - 30) / 2 - y(t) / 2)
        const bands = series.map((s, k) => {
          const top = months.map((_, i) => [x(i), base[i]] as [number, number])
          const next = months.map((mo, i) => base[i] + y(s.get(mo) ?? 0))
          const bottom = months.map(
            (_, i) => [x(i), next[i]] as [number, number],
          )
          base = next
          return {
            d: bandPath(top, bottom),
            c: color(k),
            name: fieldName(fields[k].name),
          }
        })
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Streamgraph of monthly ads by occupation field"
            >
              {bands.map((b) => (
                <path
                  key={b.name}
                  d={b.d}
                  fill={b.c}
                  stroke="var(--paper)"
                  strokeWidth={0.5}
                >
                  <title>{b.name}</title>
                </path>
              ))}
              <XLabels
                y={H - 6}
                items={yearTicks(months).map((t) => ({
                  x: Math.max(16, x(t.index)),
                  label: t.label,
                }))}
              />
            </Svg>
            <Legend items={bands.map((b) => [b.name, b.c])} />
          </>
        )
      }}
    </Frame>
  )
}

function Calendar() {
  const data = useData<Market>(MARKET)
  const [metric, setMetric] = useState<'ads' | 'vacancies'>('ads')
  return (
    <Frame data={data}>
      {(m) => {
        const k = metric === 'ads' ? 1 : 2
        const rows = m.monthly.all ?? []
        const max = Math.max(...rows.map((r) => r[k]))
        const min = Math.min(...rows.map((r) => r[k]))
        const cell = 30
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={['ads', 'vacancies'] as const}
              value={metric}
              onChange={setMetric}
            />
            <Svg
              w={46 + 12 * cell}
              h={m.years.length * cell + 24}
              label="Calendar heatmap of monthly ads"
            >
              {m.years.map((yr, j) => (
                <text
                  key={yr}
                  x={40}
                  y={j * cell + cell / 2 + 4}
                  textAnchor="end"
                >
                  {yr}
                </text>
              ))}
              {'JFMAMJJASOND'.split('').map((c, i) => (
                <text
                  key={i}
                  x={46 + i * cell + cell / 2}
                  y={m.years.length * cell + 16}
                  textAnchor="middle"
                >
                  {c}
                </text>
              ))}
              {rows.map((r) => {
                const j = m.years.indexOf(Number(r[0].slice(0, 4)))
                const i = Number(r[0].slice(5, 7)) - 1
                const t = (r[k] - min) / (max - min || 1)
                return (
                  <rect
                    key={r[0]}
                    x={46 + i * cell + 1}
                    y={j * cell + 1}
                    width={cell - 2}
                    height={cell - 2}
                    rx={5}
                    fill={`color-mix(in srgb, ${color(0)} ${Math.round(10 + t * 90)}%, var(--paper))`}
                  >
                    <title>{`${r[0]}: ${fmt(r[k])}`}</title>
                  </rect>
                )
              })}
            </Svg>
            <Legend
              items={[
                [
                  compact(min),
                  `color-mix(in srgb, ${color(0)} 10%, var(--paper))`,
                ],
                [compact(max), color(0)],
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
    id: 'job-monthly-line',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'wide',
    render: () => <MonthlyLine />,
  },
  {
    id: 'job-calendar',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <Calendar />,
  },
  {
    id: 'job-stream',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'wide',
    render: () => <Stream />,
  },
]
