/** OECD revenue statistics: Sweden's tax mix and the country league. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  YAxis,
  band,
  fmt,
  niceMax,
  scale,
  squarify,
} from './wel-kit'

type TaxType = { tax_code: string; name_en: string; parent_code: string | null }

type Country = { country_code: string; name_en: string; is_nordic: boolean }

type Sweden = {
  types: TaxType[]
  rows: [number, string, number | null, number | null][]
}

type Countries = {
  types: TaxType[]
  countries: Country[]
  rows: [string, number, string, number | null][]
}

const useSweden = () => useData<Sweden>('taxes/sweden.json')

const useCountries = () => useData<Countries>('taxes/countries.json')

const tops = (types: TaxType[]) => types.filter((t) => t.parent_code === '_T')

function latest(d: Countries, code = '_T') {
  const rows = d.rows.filter((r) => r[2] === code && r[3] !== null)
  const year = Math.max(...rows.map((r) => r[1]))
  return { year, rows: rows.filter((r) => r[1] === year) }
}

function MixArea() {
  const data = useSweden()
  const [m, setM] = useState<'% of GDP' | 'SEK bn'>('% of GDP')
  return (
    <Frame data={data}>
      {(d) => {
        const col = m === '% of GDP' ? 2 : 3
        const codes = tops(d.types).map((t) => t.tax_code)
        const years = [...new Set(d.rows.map((r) => r[0]))].sort()
        const at = new Map(d.rows.map((r) => [`${r[0]}:${r[1]}`, r[col] ?? 0]))
        const total = years.map((y) =>
          codes.reduce((s, c) => s + (at.get(`${y}:${c}`) ?? 0), 0),
        )
        const top = niceMax(Math.max(...total))
        const x = scale([0, years.length - 1], [40, 790])
        const y = scale([0, top], [370, 15])
        const xs = years.map((_, i) => x(i))
        let base = years.map(() => 0)
        return (
          <>
            <Slicer
              label="Unit"
              options={['% of GDP', 'SEK bn'] as const}
              value={m}
              onChange={setM}
            />
            <Svg w={800} h={400} label="Sweden's tax revenue by type, stacked">
              <YAxis max={top} x0={40} x1={790} y0={370} y1={15} />
              {codes.map((c, j) => {
                const lo = base
                const hi = years.map(
                  (yr, i) => lo[i] + (at.get(`${yr}:${c}`) ?? 0),
                )
                base = hi
                return (
                  <path
                    key={c}
                    d={band(xs, hi.map(y), lo.map(y))}
                    fill={color(j)}
                  />
                )
              })}
              <XTicks
                values={years.map((v, i) => (i % 10 ? '' : v))}
                x={x}
                y={390}
              />
            </Svg>
            <Legend items={tops(d.types).map((t) => t.name_en.split(',')[0])} />
          </>
        )
      }}
    </Frame>
  )
}

function Treemap() {
  const data = useSweden()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(d) => {
        const parents = new Set(d.types.map((t) => t.parent_code))
        const leaves = d.types.filter(
          (t) => !parents.has(t.tax_code) && t.tax_code !== '_T',
        )
        const years = [...new Set(d.rows.map((r) => r[0]))].sort()
        const opts = years.filter(
          (v) => v % 10 === years[years.length - 1] % 10,
        )
        const year = yr ?? years[years.length - 1]
        const at = new Map(
          d.rows.filter((r) => r[0] === year).map((r) => [r[1], r[2] ?? 0]),
        )
        const vals = leaves.map((t) => Math.max(0, at.get(t.tax_code) ?? 0))
        const rects = squarify(vals, { x: 0, y: 0, w: 400, h: 400 })
        const top = tops(d.types).map((t) => t.tax_code)
        const family = (t: TaxType) => {
          let p: TaxType | undefined = t
          while (p && !top.includes(p.tax_code))
            p = d.types.find((q) => q.tax_code === p!.parent_code)
          return p ? top.indexOf(p.tax_code) : 0
        }
        return (
          <>
            <Slicer label="Year" options={opts} value={year} onChange={setYr} />
            <Svg label="Squarified treemap of Sweden's taxes as a share of GDP">
              {rects.map((r, i) =>
                r.w > 0 ? (
                  <g key={leaves[i].tax_code}>
                    <rect
                      x={r.x + 1}
                      y={r.y + 1}
                      width={Math.max(0, r.w - 2)}
                      height={Math.max(0, r.h - 2)}
                      rx={4}
                      fill={color(family(leaves[i]))}
                    >
                      <title>{`${leaves[i].name_en}: ${fmt(vals[i], 2)}% of GDP`}</title>
                    </rect>
                    {r.w > 44 && r.h > 18 ? (
                      <text
                        x={r.x + 6}
                        y={r.y + 15}
                        style={{ fill: 'var(--ink)' }}
                      >
                        {fmt(vals[i])}%
                      </text>
                    ) : null}
                  </g>
                ) : null,
              )}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function League() {
  const data = useCountries()
  const [code, setCode] = useState('_T')
  return (
    <Frame data={data}>
      {(d) => {
        const { rows } = latest(d, code)
        const sorted = [...rows].sort((a, b) => b[3]! - a[3]!)
        const nordic = new Set(
          d.countries.filter((c) => c.is_nordic).map((c) => c.country_code),
        )
        const top = niceMax(sorted[0]?.[3] ?? 1)
        const x = scale([0, top], [40, 392])
        const h = 780 / Math.max(1, sorted.length)
        return (
          <>
            <Slicer
              label="Tax"
              options={d.types.map((t) => t.tax_code)}
              value={code}
              onChange={setCode}
            />
            <Svg
              w={400}
              h={800}
              label="Countries ranked by tax revenue as a share of GDP"
            >
              {sorted.map((r, i) => (
                <g key={r[0]}>
                  <rect
                    x={40}
                    y={i * h + 2}
                    width={x(r[3]!) - 40}
                    height={h - 3}
                    rx={2}
                    fill={
                      r[0] === 'SWE'
                        ? color(1)
                        : nordic.has(r[0])
                          ? color(0)
                          : color(2)
                    }
                  >
                    <title>{`${d.countries.find((c) => c.country_code === r[0])?.name_en}: ${fmt(r[3]!)}%`}</title>
                  </rect>
                  <text x={36} y={i * h + h / 2 + 3} textAnchor="end">
                    {r[0]}
                  </text>
                </g>
              ))}
            </Svg>
            <Legend items={['SWE', 'Nordic', 'other OECD']} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-tax-mix-area',
    domain: 'taxes',
    size: 'wide',
    render: () => <MixArea />,
  },
  {
    id: 'wel-tax-league',
    domain: 'taxes',
    size: 'tall',
    render: () => <League />,
  },
  { id: 'wel-tax-treemap', domain: 'taxes', render: () => <Treemap /> },
]
