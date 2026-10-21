/** The county-year welfare panel: small multiples, scatter, beeswarm, parallel lines. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  extent,
  fmt,
  groupBy,
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

function Parallel() {
  const data = usePanel()
  return (
    <Frame data={data}>
      {(all) => {
        const keys = Object.values(METRICS)
        const yr = Math.max(
          ...counties(all)
            .filter((r) => keys.every((k) => num(r[k])))
            .map((r) => r.year),
        )
        const rows = counties(all).filter(
          (r) => r.year === yr && keys.every((k) => num(r[k])),
        )
        const x = scale([0, keys.length - 1], [30, 770])
        const ys = keys.map((k) =>
          scale(extent(rows.map((r) => r[k]!)), [370, 20]),
        )
        return (
          <>
            <Svg
              w={800}
              h={400}
              label="Parallel coordinates of seven county indicators"
            >
              {keys.map((k, i) => (
                <line
                  key={k}
                  x1={x(i)}
                  x2={x(i)}
                  y1={20}
                  y2={370}
                  stroke="var(--muted)"
                  strokeWidth={0.6}
                />
              ))}
              {rows.map((r, j) => (
                <path
                  key={r.region_code}
                  d={path(keys.map((k, i) => [x(i), ys[i](r[k]!)]))}
                  fill="none"
                  stroke={color(j)}
                  strokeWidth={1.6}
                  opacity={0.8}
                >
                  <title>{r.region_name}</title>
                </path>
              ))}
              <XTicks values={NAMES} x={x} y={392} />
            </Svg>
            <Legend items={[String(yr)]} />
          </>
        )
      }}
    </Frame>
  )
}

function Turnout() {
  const data = usePanel()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(all) => {
        const rows = counties(all).filter((r) => num(r.turnout_riksdag_pct))
        const nat = all
          .filter((r) => r.is_country && num(r.turnout_riksdag_pct))
          .sort((a, b) => a.year - b.year)
        const opts = nat
          .filter(
            (r, i) =>
              i > 0 && r.turnout_riksdag_pct !== nat[i - 1].turnout_riksdag_pct,
          )
          .map((r) => r.year)
        const year = yr ?? opts[opts.length - 1]
        const pick = rows
          .filter((r) => r.year === year)
          .sort((a, b) => b.turnout_riksdag_pct! - a.turnout_riksdag_pct!)
        const [lo] = extent(rows.map((r) => r.turnout_riksdag_pct!))
        const x = scale([Math.floor(lo), 100], [10, 390])
        const h = 360 / pick.length
        return (
          <>
            <Slicer
              label="Election year"
              options={opts}
              value={year}
              onChange={setYr}
            />
            <Svg label="Riksdag turnout by county as a lollipop chart">
              {pick.map((r, i) => (
                <g key={r.region_code}>
                  <line
                    x1={x(Math.floor(lo))}
                    x2={x(r.turnout_riksdag_pct!)}
                    y1={10 + i * h}
                    y2={10 + i * h}
                    stroke={color(i)}
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={x(r.turnout_riksdag_pct!)}
                    cy={10 + i * h}
                    r={h / 2.6}
                    fill={color(i)}
                  >
                    <title>{`${r.region_name}: ${fmt(r.turnout_riksdag_pct!)}%`}</title>
                  </circle>
                </g>
              ))}
              <XTicks
                values={[`${Math.floor(lo)}%`, '100%']}
                x={(i) => (i ? x(100) : x(Math.floor(lo)) + 10)}
                y={396}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function Ridgeline() {
  const data = usePanel()
  return (
    <Frame data={data}>
      {(all) => {
        const k: Metric = 'ongoing_sick_leave_per_1000'
        const rows = counties(all).filter((r) => num(r[k]))
        const groups = [...groupBy(rows, (r) => r.region_code).values()]
        const x = scale(extent(rows.map((r) => r.year)), [10, 390])
        const top = Math.max(...rows.map((r) => r[k]!))
        const step = 760 / groups.length
        return (
          <Svg
            w={400}
            h={800}
            label="Ongoing sick leave per 1000, one ridge per county"
          >
            {groups.map((g, i) => {
              const base = 60 + i * step
              const y = scale([0, top], [base, base - 90])
              const d = path(g.map((r) => [x(r.year), y(r[k]!)]))
              return (
                <path
                  key={g[0].region_code}
                  d={`${d}L${x(g[g.length - 1].year)},${base}L${x(g[0].year)},${base}Z`}
                  fill={color(i)}
                  stroke="var(--paper)"
                  strokeWidth={1.2}
                  opacity={0.92}
                >
                  <title>{g[0].region_name}</title>
                </path>
              )
            })}
          </Svg>
        )
      }}
    </Frame>
  )
}

function HealthTrust() {
  const data = usePanel()
  return (
    <Frame data={data}>
      {(all) => {
        const ok = counties(all).filter(
          (r) => num(r.fohm_good_health_pct) && num(r.fohm_hard_to_trust_pct),
        )
        const yr = Math.max(...ok.map((r) => r.year))
        const rows = ok
          .filter((r) => r.year === yr)
          .sort((a, b) => a.fohm_good_health_pct! - b.fohm_good_health_pct!)
        const x = scale([0, 100], [10, 390])
        const h = 370 / rows.length
        return (
          <>
            <Svg label="Good health and hard-to-trust shares by county">
              {rows.map((r, i) => (
                <g key={r.region_code}>
                  <line
                    x1={x(r.fohm_hard_to_trust_pct!)}
                    x2={x(r.fohm_good_health_pct!)}
                    y1={14 + i * h}
                    y2={14 + i * h}
                    stroke="var(--muted)"
                    strokeWidth={0.8}
                  />
                  <circle
                    cx={x(r.fohm_hard_to_trust_pct!)}
                    cy={14 + i * h}
                    r={5}
                    fill={color(1)}
                  />
                  <circle
                    cx={x(r.fohm_good_health_pct!)}
                    cy={14 + i * h}
                    r={5}
                    fill={color(0)}
                  >
                    <title>{r.region_name}</title>
                  </circle>
                </g>
              ))}
              <XTicks
                values={['0%', '50%', '100%']}
                x={(i) => x(i * 50)}
                y={396}
              />
            </Svg>
            <Legend items={['good health %', 'hard to trust %']} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'wel-turnout-lollipop', domain: 'welfare', render: () => <Turnout /> },
  {
    id: 'wel-county-parallel',
    domain: 'welfare',
    size: 'wide',
    render: () => <Parallel />,
  },
  {
    id: 'wel-sick-ridgeline',
    domain: 'welfare',
    size: 'tall',
    render: () => <Ridgeline />,
  },
  { id: 'wel-health-trust', domain: 'welfare', render: () => <HealthTrust /> },
]
