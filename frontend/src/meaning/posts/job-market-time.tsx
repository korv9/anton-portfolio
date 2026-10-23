/** Jobs: the ad market over time, from market.json's monthly, daily and archive counts. */
import { useState } from 'react'
import { color, focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'
import {
  bandPath,
  compact,
  D,
  fieldName,
  Legend,
  linePath,
  MARKET,
  sum,
  Svg,
  XLabels,
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
        const W = 600,
          H = 220,
          L = 40,
          R = 516,
          B = 196
        const x = linearScale([0, rows.length - 1], [L, R])
        const ticks = niceTicks(Math.max(1, ...rows.map((r) => r[2])))
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
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
              <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
              <path
                d={linePath(vac)}
                fill="none"
                stroke={OTHER}
                strokeWidth={1.5}
              />
              <path
                d={linePath(ads)}
                fill="none"
                stroke={focal(true)}
                strokeWidth={2}
              />
              <EndLabels
                x={R + 6}
                top={10}
                bottom={B}
                items={[
                  {
                    y: vac.at(-1)?.[1] ?? B,
                    label: 'vacancies',
                    color: 'var(--mean-muted)',
                  },
                  { y: ads.at(-1)?.[1] ?? B, label: 'ads', color: focal(true) },
                ]}
              />
              <XLabels
                y={H - 4}
                items={yearTicks(rows.map((r) => r[0])).map((t) => ({
                  x: x(t.index),
                  label: t.label,
                }))}
              />
            </Svg>
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

const MONTHS = 'JFMAMJJASOND'.split('')

/** Monthly ads for the last six years, one line each; the latest year is the focal one. */
function Calendar() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = m.monthly.all ?? []
        const years = m.years.slice(-6)
        const ticks = niceTicks(Math.max(1, ...rows.map((r) => r[1])))
        const W = 300,
          H = 220,
          L = 34,
          R = 252,
          B = 196
        const x = linearScale([1, 12], [L + 4, R])
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const line = (yr: number) =>
          rows
            .filter((r) => Number(r[0].slice(0, 4)) === yr)
            .map(
              (r) => [x(Number(r[0].slice(5, 7))), y(r[1])] as [number, number],
            )
        const latest = years.at(-1)
        return (
          <Svg w={W} h={H} label="Job ads per month, one line per year">
            <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
            {years.map((yr) => (
              <path
                key={yr}
                d={linePath(line(yr))}
                fill="none"
                stroke={focal(yr === latest)}
                strokeWidth={yr === latest ? 2.5 : 1.25}
              >
                <title>{String(yr)}</title>
              </path>
            ))}
            <EndLabels
              x={R + 6}
              top={10}
              bottom={B}
              items={years.map((yr) => ({
                y: line(yr).at(-1)?.[1] ?? B,
                label: String(yr),
                color: yr === latest ? focal(true) : 'var(--mean-muted)',
              }))}
            />
            <XLabels
              y={H - 4}
              items={MONTHS.map((c, i) => ({ x: x(i + 1), label: c }))}
            />
          </Svg>
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
    title: 'Job ads and the vacancies they list, per month',
    note: 'One ad can list several vacancies; 2020 on, Arbetsförmedlingen',
    render: () => <MonthlyLine />,
  },
  {
    id: 'job-calendar',
    domain: D,
    sources: ['jobs/market.json'],
    title: 'Job ads per month, one line per year',
    note: 'New ads published each month, the last six years; the latest year runs to the latest full month',
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
