/** Labour market and sick leave, national by month and county by year. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Svg,
  XTicks,
  YAxis,
  band,
  extent,
  fmt,
  groupBy,
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

type County = {
  region_code: string
  region_name: string
  year: number
  unemployment_rate_pct: number | null
  stress_cases_per_1000: number | null
}

const useMonths = () => useData<Month[]>('welfare/national-month.json')

const useCounties = () => useData<County[]>('welfare/county-year.json')

const short = (name: string) => name.replace(/s? län$/, '')

function PsychShare() {
  const data = useMonths()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter((d) =>
          num(d.psychiatric_share_of_started_12m_pct),
        )
        const v = r.map((d) => d.psychiatric_share_of_started_12m_pct!)
        const x = scale([0, r.length - 1], [10, 390])
        const y = scale([0, niceMax(Math.max(...v))], [395, 200])
        const last = v[v.length - 1]
        return (
          <Svg label="Psychiatric share of started sick-leave cases, rolling 12 months">
            <path
              d={band(
                v.map((_, i) => x(i)),
                v.map((d) => y(d)),
                v.map(() => 395),
              )}
              fill={color(2)}
            />
            <path
              d={path(v.map((d, i) => [x(i), y(d)]))}
              fill="none"
              stroke={color(0)}
              strokeWidth={2}
            />
            <text
              x={200}
              y={130}
              textAnchor="middle"
              style={{ fontSize: 96, fill: 'var(--ink)', fontWeight: 600 }}
            >
              {fmt(last)}%
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

function CountyBump() {
  const data = useCounties()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter((d) => num(d.unemployment_rate_pct))
        const years = [...new Set(r.map((d) => d.year))].sort()
        const byYear = groupBy(r, (d) => d.year)
        const rank = new Map<string, number>()
        for (const [yr, list] of byYear)
          [...list]
            .sort((a, b) => b.unemployment_rate_pct! - a.unemployment_rate_pct!)
            .forEach((d, i) => rank.set(`${d.region_code}:${yr}`, i))
        const codes = [...new Set(r.map((d) => d.region_code))]
        const x = scale([0, years.length - 1], [14, 386])
        const y = scale([0, codes.length - 1], [14, 780])
        return (
          <Svg
            w={400}
            h={800}
            label="County unemployment rank by year, highest first"
          >
            {codes.map((c, j) => {
              const pts = years
                .map((yr, i) => [i, rank.get(`${c}:${yr}`)] as const)
                .filter((p) => p[1] !== undefined)
              return (
                <path
                  key={c}
                  d={path(pts.map(([i, k]) => [x(i), y(k!)]))}
                  fill="none"
                  stroke={color(j)}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={0.85}
                >
                  <title>
                    {r.find((d) => d.region_code === c)!.region_name}
                  </title>
                </path>
              )
            })}
            <XTicks
              values={years.map((v, i) => (i % 5 ? '' : v))}
              x={x}
              y={798}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function CountyHeat() {
  const data = useCounties()
  const [m, setM] = useState<'unemployment' | 'stress'>('unemployment')
  return (
    <Frame data={data}>
      {(rows) => {
        const key =
          m === 'unemployment'
            ? 'unemployment_rate_pct'
            : 'stress_cases_per_1000'
        const r = rows.filter((d) => num(d[key]))
        const years = [...new Set(r.map((d) => d.year))].sort()
        const codes = [...new Set(rows.map((d) => d.region_code))]
        const [lo, hi] = extent(r.map((d) => d[key]!))
        const cw = 680 / years.length
        const ch = 360 / codes.length
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={['unemployment', 'stress'] as const}
              value={m}
              onChange={setM}
            />
            <Svg w={800} h={400} label="County by year heatmap">
              {r.map((d) => (
                <rect
                  key={d.region_code + d.year}
                  x={110 + years.indexOf(d.year) * cw}
                  y={codes.indexOf(d.region_code) * ch}
                  width={cw - 1}
                  height={ch - 1}
                  fill={`color-mix(in srgb, var(--cv-olive) ${Math.round(((d[key]! - lo) / (hi - lo)) * 100)}%, var(--cluster-butter))`}
                >
                  <title>{`${d.region_name} ${d.year}: ${fmt(d[key]!)}`}</title>
                </rect>
              ))}
              {codes.map((c, i) => (
                <text key={c} x={106} y={i * ch + ch / 2 + 3} textAnchor="end">
                  {short(rows.find((d) => d.region_code === c)!.region_name)}
                </text>
              ))}
              <XTicks
                values={years.map((v, i) => (i % 4 ? '' : v))}
                x={(i) => 110 + i * cw + cw / 2}
                y={392}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function CountySlope() {
  const data = useCounties()
  return (
    <Frame data={data}>
      {(rows) => {
        const r = rows.filter((d) => num(d.unemployment_rate_pct))
        const years = extent(r.map((d) => d.year))
        const at = (yr: number) =>
          new Map(
            r
              .filter((d) => d.year === yr)
              .map((d) => [d.region_code, d.unemployment_rate_pct!]),
          )
        const a = at(years[0])
        const b = at(years[1])
        const top = niceMax(Math.max(...a.values(), ...b.values()))
        const y = scale([0, top], [380, 20])
        return (
          <Svg label="County unemployment, first and last year">
            <YAxis max={top} x0={60} x1={340} y0={380} y1={20} />
            {[...a].map(([c, v], i) =>
              b.has(c) ? (
                <g key={c}>
                  <line
                    x1={90}
                    x2={310}
                    y1={y(v)}
                    y2={y(b.get(c)!)}
                    stroke={color(i)}
                    strokeWidth={2}
                  />
                  <circle cx={90} cy={y(v)} r={4} fill={color(i)} />
                  <circle cx={310} cy={y(b.get(c)!)} r={4} fill={color(i)} />
                </g>
              ) : null,
            )}
            <XTicks values={years} x={(i) => (i ? 310 : 90)} y={396} />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-psych-share',
    domain: 'welfare',
    sources: ['welfare/national-month.json'],
    render: () => <PsychShare />,
  },
  {
    id: 'wel-county-bump',
    domain: 'welfare',
    sources: ['welfare/county-year.json'],
    size: 'tall',
    render: () => <CountyBump />,
  },
  {
    id: 'wel-county-heat',
    domain: 'welfare',
    sources: ['welfare/county-year.json'],
    size: 'wide',
    render: () => <CountyHeat />,
  },
  {
    id: 'wel-county-slope',
    domain: 'welfare',
    sources: ['welfare/county-year.json'],
    render: () => <CountySlope />,
  },
]
