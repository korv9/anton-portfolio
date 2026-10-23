/** OECD revenue statistics: Sweden's tax mix and the country league. */
import { Frame, color, useData, type Post } from '../kit'
import {
  Kpi,
  Legend,
  Svg,
  XTicks,
  YAxis,
  extent,
  fmt,
  groupBy,
  niceMax,
  path,
  scale,
} from './wel-kit'

type TaxType = { tax_code: string; name_en: string; parent_code: string | null }

type Country = { country_code: string; name_en: string; is_nordic: boolean }

type Countries = {
  types: TaxType[]
  countries: Country[]
  rows: [string, number, string, number | null][]
}

const useCountries = () => useData<Countries>('taxes/countries.json')

function latest(d: Countries, code = '_T') {
  const rows = d.rows.filter((r) => r[2] === code && r[3] !== null)
  const year = Math.max(...rows.map((r) => r[1]))
  return { year, rows: rows.filter((r) => r[1] === year) }
}

function CountrySlope() {
  const data = useCountries()
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d.rows.filter((r) => r[2] === '_T' && r[3] !== null)
        const byC = groupBy(rows, (r) => r[0])
        const first = 2000
        const last = Math.max(...rows.map((r) => r[1]))
        const pairs = [...byC]
          .map(
            ([c, list]) =>
              [
                c,
                list.find((r) => r[1] === first)?.[3],
                list.find((r) => r[1] === last)?.[3],
              ] as const,
          )
          .filter((p) => p[1] != null && p[2] != null)
        const [lo, hi] = extent(pairs.flatMap((p) => [p[1]!, p[2]!]))
        const y = scale(
          [Math.floor(lo / 5) * 5, Math.ceil(hi / 5) * 5],
          [380, 20],
        )
        return (
          <Svg label="Total tax revenue share of GDP, 2000 against latest year">
            {pairs.map(([c, a, b], i) => (
              <g key={c} opacity={c === 'SWE' ? 1 : 0.55}>
                <line
                  x1={80}
                  x2={320}
                  y1={y(a!)}
                  y2={y(b!)}
                  stroke={c === 'SWE' ? 'var(--ink)' : color(i)}
                  strokeWidth={c === 'SWE' ? 3 : 1.2}
                >
                  <title>{c}</title>
                </line>
                <circle cx={80} cy={y(a!)} r={3} fill={color(i)} />
                <circle cx={320} cy={y(b!)} r={3} fill={color(i)} />
              </g>
            ))}
            <XTicks values={[first, last]} x={(i) => (i ? 320 : 80)} y={396} />
          </Svg>
        )
      }}
    </Frame>
  )
}

function NordicLines() {
  const data = useCountries()
  return (
    <Frame data={data}>
      {(d) => {
        const nordic = d.countries.filter((c) => c.is_nordic)
        const rows = d.rows.filter((r) => r[2] === '_T' && r[3] !== null)
        const [y0, y1] = extent(rows.map((r) => r[1]))
        const top = niceMax(Math.max(...rows.map((r) => r[3]!)))
        const x = scale([y0, y1], [36, 790])
        const y = scale([0, top], [370, 15])
        return (
          <>
            <Svg
              w={800}
              h={400}
              label="Total tax revenue share of GDP, Nordic countries against the rest"
            >
              <YAxis max={top} x0={36} x1={790} y0={370} y1={15} />
              {[...groupBy(rows, (r) => r[0])].map(([c, list]) => {
                const n = nordic.findIndex((q) => q.country_code === c)
                return (
                  <path
                    key={c}
                    d={path(list.map((r) => [x(r[1]), y(r[3]!)]))}
                    fill="none"
                    stroke={n < 0 ? 'var(--muted)' : color(n)}
                    strokeWidth={n < 0 ? 0.6 : 3}
                    opacity={n < 0 ? 0.4 : 1}
                  />
                )
              })}
              <XTicks values={[y0, y1]} x={(i) => (i ? 770 : 56)} y={390} />
            </Svg>
            <Legend items={nordic.map((c) => c.name_en)} />
          </>
        )
      }}
    </Frame>
  )
}

function SwedenKpi() {
  const data = useCountries()
  return (
    <Frame data={data}>
      {(d) => {
        const { year, rows } = latest(d)
        const se = rows.find((r) => r[0] === 'SWE')
        const prev = d.rows.find(
          (r) => r[0] === 'SWE' && r[2] === '_T' && r[1] === year - 1,
        )?.[3]
        return se ? (
          <Kpi
            value={fmt(se[3]!)}
            unit="% of GDP"
            delta={prev != null ? se[3]! - prev : undefined}
          />
        ) : null
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-tax-kpi',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    render: () => <SwedenKpi />,
  },
  {
    id: 'wel-tax-nordic-lines',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    size: 'wide',
    render: () => <NordicLines />,
  },
  {
    id: 'wel-tax-slope',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    render: () => <CountrySlope />,
  },
]
