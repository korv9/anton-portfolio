/** The county-year welfare panel: small multiples, scatter, beeswarm, parallel lines. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Svg,
  XTicks,
  YAxis,
  extent,
  fmt,
  groupBy,
  niceMax,
  num,
  path,
  scale,
} from './wel-kit'

type Row = {
  region_code: string
  region_name: string
  is_country: boolean
  year: number
  population: number
  median_earned_income_sek: number | null
  social_assistance_pct: number | null
  ill_health_days: number | null
  violent_crime_per_100k: number | null
  turnout_riksdag_pct: number | null
  ongoing_sick_leave_per_1000: number | null
  employment_rate_pct: number | null
  fohm_good_health_pct: number | null
  fohm_hard_to_trust_pct: number | null
}

type Metric = keyof Pick<
  Row,
  | 'median_earned_income_sek'
  | 'social_assistance_pct'
  | 'ill_health_days'
  | 'violent_crime_per_100k'
  | 'turnout_riksdag_pct'
  | 'ongoing_sick_leave_per_1000'
  | 'employment_rate_pct'
>

const METRICS: Record<string, Metric> = {
  income: 'median_earned_income_sek',
  assistance: 'social_assistance_pct',
  'ill health': 'ill_health_days',
  crime: 'violent_crime_per_100k',
  turnout: 'turnout_riksdag_pct',
  'sick leave': 'ongoing_sick_leave_per_1000',
  employment: 'employment_rate_pct',
}

const NAMES = Object.keys(METRICS)

const usePanel = () => useData<Row[]>('welfare/panel-county-year.json')

const counties = (rows: Row[]) => rows.filter((r) => !r.is_country)

const years = (rows: Row[], k: Metric) =>
  [...new Set(rows.filter((r) => num(r[k])).map((r) => r.year))].sort()

function Multiples() {
  const data = usePanel()
  const [m, setM] = useState('assistance')
  return (
    <Frame data={data}>
      {(all) => {
        const k = METRICS[m]
        const rows = counties(all).filter((r) => num(r[k]))
        const groups = [...groupBy(rows, (r) => r.region_code).values()]
        const [lo, hi] = extent(rows.map((r) => r[k]!))
        const [y0, y1] = extent(rows.map((r) => r.year))
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={NAMES}
              value={m}
              onChange={setM}
            />
            <Svg w={400} h={520} label="One sparkline per county">
              {groups.map((g, i) => {
                const cx = (i % 4) * 100
                const cy = Math.floor(i / 4) * 86
                const x = scale([y0, y1], [cx + 6, cx + 94])
                const y = scale([lo, hi], [cy + 70, cy + 22])
                const d = path(g.map((r) => [x(r.year), y(r[k]!)]))
                return (
                  <g key={g[0].region_code}>
                    <rect
                      x={cx + 2}
                      y={cy + 2}
                      width={96}
                      height={82}
                      rx={8}
                      fill="var(--wash)"
                    />
                    <path
                      d={`${d}L${x(g[g.length - 1].year)},${cy + 80}L${x(g[0].year)},${cy + 80}Z`}
                      fill={color(i)}
                      opacity={0.35}
                    />
                    <path d={d} fill="none" stroke={color(i)} strokeWidth={1.8}>
                      <title>{g[0].region_name}</title>
                    </path>
                    <text x={cx + 8} y={cy + 16}>
                      {fmt(g[g.length - 1][k]!)}
                    </text>
                  </g>
                )
              })}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function IncomeScatter() {
  const data = usePanel()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(all) => {
        const rows = counties(all).filter(
          (r) =>
            num(r.median_earned_income_sek) && num(r.social_assistance_pct),
        )
        const ys = [...new Set(rows.map((r) => r.year))].sort()
        const year = yr ?? ys[ys.length - 1]
        const pick = rows.filter((r) => r.year === year)
        const x = scale(
          extent(rows.map((r) => r.median_earned_income_sek!)),
          [40, 380],
        )
        const top = niceMax(
          Math.max(...rows.map((r) => r.social_assistance_pct!)),
        )
        const y = scale([0, top], [370, 20])
        return (
          <>
            <Slicer
              label="Year"
              options={ys.filter((v) => v % 3 === ys[ys.length - 1] % 3)}
              value={year}
              onChange={setYr}
            />
            <Svg label="Median income against social assistance by county, sized by population">
              <YAxis max={top} x0={40} x1={380} y0={370} y1={20} />
              {pick.map((r, i) => (
                <circle
                  key={r.region_code}
                  cx={x(r.median_earned_income_sek!)}
                  cy={y(r.social_assistance_pct!)}
                  r={4 + Math.sqrt(r.population) / 90}
                  fill={color(i)}
                  opacity={0.75}
                  stroke="var(--paper)"
                >
                  <title>{`${r.region_name}: ${fmt(r.median_earned_income_sek!)} SEK, ${fmt(r.social_assistance_pct!)}%`}</title>
                </circle>
              ))}
              <XTicks
                values={extent(
                  rows.map((r) => r.median_earned_income_sek!),
                ).map((v) => `${fmt(v)} SEK`)}
                x={(i) => (i ? 350 : 70)}
                y={392}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function Beeswarm() {
  const data = usePanel()
  const [m, setM] = useState('crime')
  return (
    <Frame data={data}>
      {(all) => {
        const k = METRICS[m]
        const rows = counties(all).filter((r) => num(r[k]))
        const ys = years(rows, k)
        const x = scale(extent(rows.map((r) => r[k]!)), [20, 780])
        const lane = 360 / ys.length
        const placed: { cx: number; cy: number; r: Row }[] = []
        for (const yr of ys) {
          const base = 20 + ys.indexOf(yr) * lane + lane / 2
          const taken: [number, number][] = []
          for (const r of rows
            .filter((d) => d.year === yr)
            .sort((a, b) => a[k]! - b[k]!)) {
            const cx = x(r[k]!)
            let off = 0
            for (
              let s = 1;
              taken.some(
                ([tx, ty]) => Math.hypot(tx - cx, ty - (base + off)) < 7,
              );
              s++
            )
              off = (s % 2 ? 1 : -1) * Math.ceil(s / 2) * 3.5
            taken.push([cx, base + off])
            placed.push({ cx, cy: base + off, r })
          }
        }
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={NAMES}
              value={m}
              onChange={setM}
            />
            <Svg w={800} h={400} label="Counties as dots, one row per year">
              {placed.map(({ cx, cy, r }) => (
                <circle
                  key={r.region_code + r.year}
                  cx={cx}
                  cy={cy}
                  r={3.2}
                  fill={color(+r.region_code)}
                >
                  <title>{`${r.region_name} ${r.year}: ${fmt(r[k]!)}`}</title>
                </circle>
              ))}
              {ys.map((yr, i) =>
                i % 4 ? null : (
                  <text key={yr} x={0} y={20 + i * lane + lane / 2 + 3}>
                    {yr}
                  </text>
                ),
              )}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-county-multiples',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    size: 'tall',
    render: () => <Multiples />,
  },
  {
    id: 'wel-income-scatter',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    render: () => <IncomeScatter />,
  },
  {
    id: 'wel-county-beeswarm',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    size: 'wide',
    render: () => <Beeswarm />,
  },
]
