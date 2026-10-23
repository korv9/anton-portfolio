/** Futures talk in the Riksdag and the size of what Sweden measures. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import {
  Legend,
  Svg,
  XTicks,
  arc,
  extent,
  fmt,
  niceMax,
  scale,
} from './wel-kit'

type Parties = { rows: [string, string, number, number, number][] }

type Themes = { themes: { id: string; label_en: string }[] }

type Summary = {
  domains: {
    id: string
    label_en: string
    scb_tables: number
    kolada_kpis: number
    geo: Record<'national' | 'county' | 'municipality' | 'subarea', number>
  }[]
  totals: { catalogue: string; items: number }[]
}

function PartyHeat() {
  const data = useData<Parties>('sweden/futures/parties.json')
  // The theme names come from trends.json, which the feed's other futures posts load anyway.
  const trends = useData<Themes>('sweden/futures/trends.json')
  const [theme, setTheme] = useState('environment')
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => {
            const names = new Map(t.themes.map((th) => [th.id, th.label_en]))
            const themes = [...new Set(d.rows.map((r) => r[1]))]
            const rows = d.rows.filter((r) => r[1] === theme && r[3] > 0)
            const parties = [...new Set(d.rows.map((r) => r[0]))].sort()
            const [y0, y1] = extent(d.rows.map((r) => r[2]))
            const share = rows.map((r) => r[4] / r[3])
            const max = Math.max(...share, 0.0001)
            const cw = 740 / (y1 - y0 + 1)
            const ch = 360 / parties.length
            return (
              <>
                <Slicer
                  label="Theme"
                  options={themes}
                  value={theme}
                  onChange={setTheme}
                  format={(k) => names.get(k) ?? k}
                />
                <Svg
                  w={800}
                  h={400}
                  label="Share of each party's future speeches using a theme, by year"
                >
                  {rows.map((r, i) => (
                    <rect
                      key={r[0] + r[2]}
                      x={50 + (r[2] - y0) * cw}
                      y={parties.indexOf(r[0]) * ch}
                      width={cw - 1}
                      height={ch - 1}
                      rx={2}
                      fill={`color-mix(in srgb, var(--cluster-apricot) ${Math.round((share[i] / max) * 100)}%, var(--wash))`}
                    >
                      <title>{`${r[0]} ${r[2]}: ${fmt(share[i] * 100)}%`}</title>
                    </rect>
                  ))}
                  {parties.map((p, i) => (
                    <text
                      key={p}
                      x={44}
                      y={i * ch + ch / 2 + 3}
                      textAnchor="end"
                    >
                      {p}
                    </text>
                  ))}
                  <XTicks values={[y0, y1]} x={(i) => (i ? 770 : 70)} y={396} />
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function MeasuredBars() {
  const data = useData<Summary>('sweden/measurement/summary.json')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = [...d.domains].sort(
          (a, b) =>
            b.scb_tables + b.kolada_kpis - (a.scb_tables + a.kolada_kpis),
        )
        const top = niceMax(rows[0].scb_tables + rows[0].kolada_kpis)
        const x = scale([0, top], [110, 392])
        const h = 380 / rows.length
        return (
          <>
            <Svg label="Statistics tables and municipal indicators per life domain">
              {rows.map((r, i) => (
                <g key={r.id}>
                  <rect
                    x={110}
                    y={i * h}
                    width={x(r.scb_tables) - 110}
                    height={h - 3}
                    fill={color(0)}
                  />
                  <rect
                    x={x(r.scb_tables)}
                    y={i * h}
                    width={x(r.kolada_kpis) - 110}
                    height={h - 3}
                    fill={color(1)}
                  />
                  <text x={106} y={i * h + h / 2 + 2} textAnchor="end">
                    {r.label_en.slice(0, 18)}
                  </text>
                </g>
              ))}
              <XTicks
                values={[0, fmt(top)]}
                x={(i) => (i ? 380 : 114)}
                y={396}
              />
            </Svg>
            <Legend items={['SCB tables', 'Kolada KPIs']} />
          </>
        )
      }}
    </Frame>
  )
}

function GeoSunburst() {
  const data = useData<Summary>('sweden/measurement/summary.json')
  return (
    <Frame data={data}>
      {(d) => {
        const levels = [
          'national',
          'county',
          'municipality',
          'subarea',
        ] as const
        const rows = d.domains.filter((r) => levels.some((l) => r.geo[l] > 0))
        const total = rows.reduce(
          (s, r) => s + levels.reduce((t, l) => t + r.geo[l], 0),
          0,
        )
        let a = 0
        return (
          <>
            <Svg label="Sunburst: statistics tables by domain, then by geographic level">
              {rows.map((r, i) => {
                const n = levels.reduce((t, l) => t + r.geo[l], 0)
                const a0 = a
                a += (n / total) * 2 * Math.PI
                let b = a0
                return (
                  <g key={r.id}>
                    <path
                      d={arc(200, 200, 60, 120, a0, a)}
                      fill={color(i)}
                      stroke="var(--paper)"
                    >
                      <title>{`${r.label_en}: ${n}`}</title>
                    </path>
                    {levels.map((l, j) => {
                      const b0 = b
                      b += (r.geo[l] / total) * 2 * Math.PI
                      return r.geo[l] ? (
                        <path
                          key={l}
                          d={arc(200, 200, 124, 190, b0, b)}
                          fill={color(i)}
                          opacity={1 - j * 0.22}
                          stroke="var(--paper)"
                          strokeWidth={0.5}
                        />
                      ) : null
                    })}
                  </g>
                )
              })}
              <text
                x={200}
                y={208}
                textAnchor="middle"
                style={{ fontSize: 28, fill: 'var(--ink)' }}
              >
                {fmt(d.totals.reduce((s, t) => s + t.items, 0))}
              </text>
            </Svg>
            <Legend items={[...levels]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-future-parties',
    domain: 'sweden',
    sources: ['sweden/futures/parties.json', 'sweden/futures/trends.json'],
    size: 'wide',
    render: () => <PartyHeat />,
  },
  {
    id: 'wel-measured-bars',
    domain: 'sweden',
    sources: ['sweden/measurement/summary.json'],
    render: () => <MeasuredBars />,
  },
  {
    id: 'wel-measured-sunburst',
    domain: 'sweden',
    sources: ['sweden/measurement/summary.json'],
    render: () => <GeoSunburst />,
  },
]
