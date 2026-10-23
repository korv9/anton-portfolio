/** Jobs: counties and conditions of employment, from market.json's regions and conditions. */
import { useState } from 'react'
import { color, focal, Frame, shade, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { EMPLOYMENT_EN, HOURS_EN } from '../../jobs/market'
import {
  knownRegion,
  arc,
  D,
  fieldName,
  fmt,
  Legend,
  MARKET,
  pct,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

const short = (r: string) => r.replace(/s? län$/, '')

function RegionLollipop() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = m.regions
          .filter(knownRegion)
          .map((r) => ({ name: short(r.region), v: r.ads.all?.[year] ?? 0 }))
          .sort((a, b) => b.v - a.v)
        const W = 400,
          rowH = 30,
          L = 110
        const x = linearScale([0, Math.sqrt(rows[0]?.v || 1)], [L, W - 20])
        return (
          <>
            <Slicer
              label="Year"
              options={m.years.filter((y) => y < m.latest_year)}
              value={year}
              onChange={setYear}
            />
            <Svg
              w={W}
              h={rows.length * rowH}
              label="Ads per county, lollipop on a square-root scale"
            >
              {rows.map((r, j) => {
                const cy = j * rowH + rowH / 2
                return (
                  <g key={r.name}>
                    <title>{`${r.name}: ${fmt(r.v)} ads`}</title>
                    <text x={L - 8} y={cy + 4} textAnchor="end" fontSize={10}>
                      {r.name}
                    </text>
                    <line
                      x1={L}
                      x2={x(Math.sqrt(r.v))}
                      y1={cy}
                      y2={cy}
                      stroke={color(j % 3)}
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(Math.sqrt(r.v))}
                      cy={cy}
                      r={8}
                      fill={color(j % 3)}
                    />
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

function RegionHeatmap() {
  const data = useData<Market>(MARKET)
  const [field, setField] = useState('All')
  return (
    <Frame data={data}>
      {(m) => {
        const opts = [
          'All',
          ...m.fields.slice(0, 8).map((f) => fieldName(f.name)),
        ]
        const id =
          m.fields.find((f) => fieldName(f.name) === field)?.id ?? 'all'
        const regions = m.regions.filter(knownRegion)
        const W = 800,
          rowH = 16,
          L = 120
        const cw = (W - L) / m.years.length
        return (
          <>
            <Slicer
              label="Field"
              options={opts}
              value={field}
              onChange={setField}
            />
            <Svg
              w={W}
              h={regions.length * rowH + 20}
              label="Heatmap of ads per county and year, each row scaled to its own peak"
            >
              {regions.map((r, j) => {
                const vals = m.years.map((yr) => r.ytd[id]?.[yr] ?? 0)
                const max = Math.max(1, ...vals)
                return (
                  <g key={r.region}>
                    <text
                      x={L - 6}
                      y={j * rowH + rowH / 2 + 4}
                      textAnchor="end"
                      fontSize={10}
                    >
                      {short(r.region)}
                    </text>
                    {vals.map((v, i) => (
                      <rect
                        key={i}
                        x={L + i * cw + 1}
                        y={j * rowH + 1}
                        width={cw - 2}
                        height={rowH - 2}
                        rx={3}
                        fill={`color-mix(in srgb, ${color(2)} ${Math.round(8 + (v / max) * 92)}%, var(--paper))`}
                      >
                        <title>{`${short(r.region)} ${m.years[i]}: ${fmt(v)}`}</title>
                      </rect>
                    ))}
                  </g>
                )
              })}
              <XLabels
                y={regions.length * rowH + 14}
                items={m.years.map((yr, i) => ({
                  x: L + i * cw + cw / 2,
                  label: String(yr),
                }))}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function EmploymentDonut() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={data}>
      {(m) => {
        const all = m.conditions[year]?.all
        const outer = Object.entries(all?.employment ?? {}).sort(
          (a, b) => b[1] - a[1],
        )
        const inner = Object.entries(all?.hours ?? {}).sort(
          (a, b) => b[1] - a[1],
        )
        // Only the outer ring's largest part takes the focal colour; the rest step through greys.
        const tone = (i: number, off: number) =>
          off === 0 && i === 0
            ? focal(true)
            : shade(i, (off ? inner : outer).length)
        const ring = (
          rows: [string, number][],
          r0: number,
          r1: number,
          off: number,
        ) => {
          const t = sum(rows.map((r) => r[1])) || 1
          let a = 0
          return rows.map(([k, v], i) => {
            const a0 = a
            a += (v / t) * 2 * Math.PI
            return (
              <path
                key={k}
                d={arc(200, 200, r0, r1, a0, a - 0.01)}
                fill={tone(i, off)}
              >
                <title>{`${EMPLOYMENT_EN[k] ?? HOURS_EN[k] ?? k}: ${pct(v / t, 1)}`}</title>
              </path>
            )
          })
        }
        return (
          <>
            <Slicer
              label="Year"
              options={m.years.filter((y) => y < m.latest_year)}
              value={year}
              onChange={setYear}
            />
            <Svg
              w={400}
              h={400}
              label="Sunburst of employment type and working hours"
            >
              {ring(outer, 140, 190, 0)}
              {ring(inner, 80, 134, 1)}
            </Svg>
            <Legend
              items={[
                ...outer.map(
                  ([k], i) =>
                    [EMPLOYMENT_EN[k] ?? k, tone(i, 0)] as [string, string],
                ),
                ...inner.map(
                  ([k], i) =>
                    [HOURS_EN[k] ?? k, tone(i, 1)] as [string, string],
                ),
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
    id: 'job-region-heatmap',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'wide',
    render: () => <RegionHeatmap />,
  },
  {
    id: 'job-employment-sunburst',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <EmploymentDonut />,
  },
  {
    id: 'job-region-lollipop',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'tall',
    render: () => <RegionLollipop />,
  },
]
