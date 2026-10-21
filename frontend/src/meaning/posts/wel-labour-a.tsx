/** Labour market and sick leave, national by month and county by year. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  YAxis,
  band,
  extent,
  fmt,
  niceMax,
  num,
  path,
  scale,
} from './wel-kit'

type Month = {
  month_start: string
  unemployment_rate_sa: number | null
  unemployment_rate_trend: number | null
  unemployment_rate: number | null
  employment_rate_sa: number | null
  unemployed_thousands: number | null
  labour_force_thousands: number | null
  started_cases: number | null
  started_psychiatric: number | null
  started_stress: number | null
  ongoing_cases: number | null
  psychiatric_share_of_started_12m_pct: number | null
}

const useMonths = () => useData<Month[]>('welfare/national-month.json')

function UnemploymentLines() {
  const data = useMonths()
  const [m, setM] = useState<'unemployment' | 'employment'>('unemployment')
  return (
    <Frame data={data}>
      {(rows) => {
        const keys: (keyof Month)[] =
          m === 'unemployment'
            ? [
                'unemployment_rate',
                'unemployment_rate_sa',
                'unemployment_rate_trend',
              ]
            : ['employment_rate_sa']
        const r = rows.filter((x) => num(x[keys[0]]))
        const [lo, hi] = extent(
          r.flatMap((x) => keys.map((k) => x[k] as number)),
        )
        const x = scale([0, r.length - 1], [36, 790])
        const y = scale([Math.floor(lo), niceMax(hi)], [370, 20])
        const years = r.map((d) => d.month_start.slice(0, 4))
        return (
          <>
            <Slicer
              label="Metric"
              options={['unemployment', 'employment'] as const}
              value={m}
              onChange={setM}
            />
            <Svg w={800} h={400} label="Monthly labour market rates, Sweden">
              <YAxis
                min={Math.floor(lo)}
                max={hi}
                x0={36}
                x1={790}
                y0={370}
                y1={20}
              />
              {keys.map((k, j) => (
                <path
                  key={k}
                  d={path(r.map((d, i) => [x(i), y(d[k] as number)]))}
                  fill="none"
                  stroke={color(j)}
                  strokeWidth={j === 2 ? 3 : 1.4}
                />
              ))}
              <XTicks
                values={years.map((v, i) => (i % 36 ? '' : v))}
                x={x}
                y={390}
              />
            </Svg>
            <Legend items={keys.map((k) => String(k).replace(/_/g, ' '))} />
          </>
        )
      }}
    </Frame>
  )
}

function LabourForceArea() {
  const data = useMonths()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter(
          (d) => num(d.labour_force_thousands) && num(d.unemployed_thousands),
        )
        const top = niceMax(
          Math.max(...r.map((d) => d.labour_force_thousands!)),
        )
        const x = scale([0, r.length - 1], [40, 790])
        const y = scale([0, top], [370, 15])
        const xs = r.map((_, i) => x(i))
        const unemp = r.map((d) => y(d.unemployed_thousands!))
        return (
          <>
            <Svg
              w={800}
              h={400}
              label="Labour force split into employed and unemployed, thousands"
            >
              <YAxis max={top} x0={40} x1={790} y0={370} y1={15} />
              <path
                d={band(
                  xs,
                  r.map((d) => y(d.labour_force_thousands!)),
                  unemp,
                )}
                fill={color(4)}
              />
              <path
                d={band(
                  xs,
                  unemp,
                  xs.map(() => y(0)),
                )}
                fill={color(1)}
              />
              <XTicks
                values={r.map((d, i) =>
                  i % 48 ? '' : d.month_start.slice(0, 4),
                )}
                x={x}
                y={390}
              />
            </Svg>
            <Legend items={['employed, k', 'unemployed, k']} />
          </>
        )
      }}
    </Frame>
  )
}

function SickStream() {
  const data = useMonths()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter(
          (d) =>
            num(d.started_cases) &&
            num(d.started_psychiatric) &&
            num(d.started_stress),
        )
        const parts = r.map((d) => [
          d.started_stress!,
          d.started_psychiatric! - d.started_stress!,
          d.started_cases! - d.started_psychiatric!,
        ])
        const max = Math.max(...parts.map((p) => p[0] + p[1] + p[2]))
        const y = scale([0, r.length - 1], [10, 790])
        const x = scale([-max / 2, max / 2], [10, 390])
        const ys = r.map((_, i) => y(i))
        let base = parts.map((p) => -(p[0] + p[1] + p[2]) / 2)
        const layers = [0, 1, 2].map((k) => {
          const lo = base
          const hi = base.map((b, i) => b + parts[i][k])
          base = hi
          const left = ys.map((yy, i) => [x(lo[i]), yy] as [number, number])
          const right = ys
            .map((yy, i) => [x(hi[i]), yy] as [number, number])
            .reverse()
          return `${path(left)}L${path(right).slice(1)}Z`
        })
        return (
          <>
            <Svg
              w={400}
              h={800}
              label="Started sick-leave cases per month as a vertical streamgraph"
            >
              {layers.map((d, k) => (
                <path key={k} d={d} fill={color(k + 1)} />
              ))}
              {r.map((d, i) =>
                i % 36 ? null : (
                  <text key={d.month_start} x={4} y={y(i)}>
                    {d.month_start.slice(0, 4)}
                  </text>
                ),
              )}
            </Svg>
            <Legend items={['stress', 'other psychiatric', 'other']} />
          </>
        )
      }}
    </Frame>
  )
}

function OngoingCalendar() {
  const data = useMonths()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter((d) => num(d.ongoing_cases))
        const years = [...new Set(r.map((d) => +d.month_start.slice(0, 4)))]
        const [lo, hi] = extent(r.map((d) => d.ongoing_cases!))
        const cw = 360 / 12
        const ch = 380 / years.length
        return (
          <Svg label="Ongoing sick-leave cases by year and month">
            {r.map((d) => {
              const yi = years.indexOf(+d.month_start.slice(0, 4))
              const mi = +d.month_start.slice(5, 7) - 1
              const t = (d.ongoing_cases! - lo) / (hi - lo)
              return (
                <rect
                  key={d.month_start}
                  x={36 + mi * cw}
                  y={6 + yi * ch}
                  width={cw - 1}
                  height={ch - 1}
                  rx={2}
                  fill={`color-mix(in srgb, var(--cluster-apricot) ${Math.round(t * 100)}%, var(--cluster-powder))`}
                >
                  <title>{`${d.month_start.slice(0, 7)}: ${fmt(d.ongoing_cases!)}`}</title>
                </rect>
              )
            })}
            <XTicks
              values={Array.from({ length: 12 }, (_, i) => i + 1)}
              x={(i) => 36 + i * cw + cw / 2}
              y={398}
            />
            {years.map((v, i) =>
              i % 5 ? null : (
                <text
                  key={v}
                  x={32}
                  y={6 + i * ch + ch / 2 + 3}
                  textAnchor="end"
                >
                  {v}
                </text>
              ),
            )}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-unemployment-lines',
    domain: 'welfare',
    size: 'wide',
    render: () => <UnemploymentLines />,
  },
  {
    id: 'wel-sick-stream',
    domain: 'welfare',
    size: 'tall',
    render: () => <SickStream />,
  },
  {
    id: 'wel-ongoing-calendar',
    domain: 'welfare',
    render: () => <OngoingCalendar />,
  },
  {
    id: 'wel-labour-force-area',
    domain: 'welfare',
    size: 'wide',
    render: () => <LabourForceArea />,
  },
]
