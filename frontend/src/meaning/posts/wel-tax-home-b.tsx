/** Taxes close to home: municipal rates, church fees, household VAT and the tax wedge. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  arc,
  extent,
  fmt,
  groupBy,
  niceMax,
  num,
  path,
  scale,
} from './wel-kit'

type Household = {
  households: {
    key: string
    name: [string, string]
    groups: {
      group: string
      name: [string, string]
      vat: number
      spending: number
      vat_rate: number
    }[]
  }[]
}

type Wedge = {
  countries: { country_code: string; is_nordic: boolean }[]
  latest: {
    country_code: string
    household_type: string
    wage_level: string
    spouse_wage_level: string | null
    income_tax_pct: number
    employee_ssc_pct: number
    employer_ssc_pct: number
    tax_wedge_pct: number
  }[]
  series: [string, number, string, number | null][]
  /** Household code -> [English, Swedish] name. */
  households: Record<string, [string, string]>
}

const useWedge = () => useData<Wedge>('taxes/wedge.json')

function VatDonut() {
  const data = useData<Household>('taxes/household.json')
  const [h, setH] = useState('E90')
  return (
    <Frame data={data}>
      {(d) => {
        const hh = d.households.find((x) => x.key === h) ?? d.households[0]
        const total = hh.groups.reduce((s, g) => s + g.vat, 0)
        let a = 0
        return (
          <>
            <Slicer
              label="Household"
              options={d.households.map((x) => x.key)}
              format={(k) =>
                d.households.find((x) => x.key === k)?.name[0] ?? k
              }
              value={hh.key}
              onChange={setH}
            />
            <Svg label="VAT paid per household by spending group">
              {hh.groups.map((g, i) => {
                const a0 = a
                a += (g.vat / total) * 2 * Math.PI
                return (
                  <path
                    key={g.group}
                    d={arc(200, 190, 92, 170 - (25 - g.vat_rate) * 2.4, a0, a)}
                    fill={color(i)}
                    stroke="var(--paper)"
                    strokeWidth={1.5}
                  >
                    <title>{`${g.name[0]}: ${fmt(g.vat)} SEK, ${g.vat_rate}%`}</title>
                  </path>
                )
              })}
              <text
                x={200}
                y={198}
                textAnchor="middle"
                style={{ fontSize: 30, fill: 'var(--ink)' }}
              >
                {fmt(total)}
              </text>
              <text x={200} y={218} textAnchor="middle">
                SEK
              </text>
            </Svg>
            <Legend items={hh.groups.map((g) => g.name[0].split(',')[0])} />
          </>
        )
      }}
    </Frame>
  )
}

function WedgeBars() {
  const data = useWedge()
  const [k, setK] = useState('S_C0 AW100')
  return (
    <Frame data={data}>
      {(d) => {
        const keyOf = (r: Wedge['latest'][number]) =>
          `${r.household_type} ${r.wage_level}${r.spouse_wage_level ? `+${r.spouse_wage_level}` : ''}`
        const opts = [...new Set(d.latest.map(keyOf))]
        const rows = d.latest
          .filter((r) => keyOf(r) === k)
          .sort((a, b) => b.tax_wedge_pct - a.tax_wedge_pct)
        const parts = [
          'income_tax_pct',
          'employee_ssc_pct',
          'employer_ssc_pct',
        ] as const
        const top = niceMax(
          Math.max(
            1,
            ...rows.map((r) =>
              parts.reduce((s, p) => s + Math.max(0, r[p]), 0),
            ),
          ),
        )
        const x = scale([0, top], [40, 392])
        const h = 780 / Math.max(1, rows.length)
        return (
          <>
            <Slicer
              label="Household and wage"
              cycles={false}
              options={opts}
              value={k}
              onChange={setK}
            />
            <Svg
              w={400}
              h={800}
              label="Tax wedge split by component per country"
            >
              {rows.map((r, i) => {
                let at = 0
                return (
                  <g
                    key={r.country_code}
                    opacity={r.country_code === 'SWE' ? 1 : 0.8}
                  >
                    {parts.map((p, j) => {
                      const v = Math.max(0, r[p])
                      const x0 = at
                      at += v
                      return (
                        <rect
                          key={p}
                          x={x(x0)}
                          y={i * h + 2}
                          width={x(at) - x(x0)}
                          height={h - 3}
                          fill={color(j + 1)}
                        />
                      )
                    })}
                    <text
                      x={36}
                      y={i * h + h / 2 + 3}
                      textAnchor="end"
                      style={
                        r.country_code === 'SWE'
                          ? { fill: 'var(--ink)', fontWeight: 700 }
                          : undefined
                      }
                    >
                      {r.country_code}
                    </text>
                    <title>{`${r.country_code}: ${fmt(r.tax_wedge_pct)}%`}</title>
                  </g>
                )
              })}
            </Svg>
            <Legend items={['income tax', 'employee SSC', 'employer SSC']} />
          </>
        )
      }}
    </Frame>
  )
}

function WedgeLines() {
  const data = useWedge()
  const [hh, setHh] = useState('S_C0')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d.series.filter((r) => r[2] === hh && num(r[3]))
        const nordic = d.countries
          .filter((c) => c.is_nordic)
          .map((c) => c.country_code)
        const [y0, y1] = extent(rows.map((r) => r[1]))
        const x = scale([y0, y1], [20, 780])
        const y = scale(
          [0, niceMax(Math.max(...rows.map((r) => r[3]!)))],
          [370, 20],
        )
        return (
          <>
            <Slicer
              label="Household"
              options={[...new Set(d.series.map((r) => r[2]))]}
              format={(k) => d.households[k]?.[0] ?? k}
              value={hh}
              onChange={setHh}
            />
            <Svg w={800} h={400} label="Tax wedge over time, every country">
              {[...groupBy(rows, (r) => r[0])].map(([c, list]) => {
                const n = nordic.indexOf(c)
                return (
                  <path
                    key={c}
                    d={path(list.map((r) => [x(r[1]), y(r[3]!)]))}
                    fill="none"
                    stroke={n < 0 ? 'var(--muted)' : color(n)}
                    strokeWidth={c === 'SWE' ? 4 : n < 0 ? 0.7 : 2}
                    opacity={n < 0 ? 0.35 : 1}
                  >
                    <title>{c}</title>
                  </path>
                )
              })}
              <XTicks values={[y0, y1]} x={(i) => (i ? 760 : 40)} y={392} />
            </Svg>
            <Legend items={nordic} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'wel-vat-donut', domain: 'taxes', render: () => <VatDonut /> },
  {
    id: 'wel-wedge-bars',
    domain: 'taxes',
    size: 'tall',
    render: () => <WedgeBars />,
  },
  {
    id: 'wel-wedge-lines',
    domain: 'taxes',
    size: 'wide',
    render: () => <WedgeLines />,
  },
]
