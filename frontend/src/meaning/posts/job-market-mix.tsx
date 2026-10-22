/** Jobs: occupations and fields, from market.json's yearly occupation and monthly field counts. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  compact,
  D,
  fmt,
  Legend,
  MARKET,
  squarify,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

/** Ads per field in the months the latest year covers, so every year compares alike. */

function OccupationBars() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={data}>
      {(m) => {
        const top = [...m.occupations]
          .sort((a, b) => (b.ads[year] ?? 0) - (a.ads[year] ?? 0))
          .slice(0, 22)
        const W = 400,
          rowH = 34,
          L = 170
        const x = linearScale([0, top[0]?.ads[year] ?? 1], [L, W - 40])
        const fi = m.fields.map((f) => f.id)
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
              h={top.length * rowH}
              label="Occupations with the most ads"
            >
              {top.map((o, j) => (
                <g key={o.id}>
                  <text
                    x={L - 6}
                    y={j * rowH + rowH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                  >
                    {o.name.length > 28 ? `${o.name.slice(0, 27)}…` : o.name}
                  </text>
                  <rect
                    x={L}
                    y={j * rowH + 6}
                    width={x(o.ads[year] ?? 0) - L}
                    height={rowH - 12}
                    rx={4}
                    fill={color(fi.indexOf(o.field))}
                  />
                  <text
                    x={x(o.ads[year] ?? 0) + 4}
                    y={j * rowH + rowH / 2 + 4}
                    fontSize={10}
                  >
                    {compact(o.ads[year] ?? 0)}
                  </text>
                </g>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function OccupationSlope() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const now = m.latest_year,
          before = now - 1
        const top = [...m.occupations]
          .sort((a, b) => (b.ytd[now] ?? 0) - (a.ytd[now] ?? 0))
          .slice(0, 30)
        const max = Math.max(
          ...top.flatMap((o) => [o.ytd[now] ?? 0, o.ytd[before] ?? 0]),
        )
        const W = 400,
          H = 400
        const y = linearScale([0, Math.sqrt(max)], [H - 30, 16])
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Slope chart of the largest occupations, this year against last"
            >
              {top.map((o) => {
                const a = o.ytd[before] ?? 0,
                  b = o.ytd[now] ?? 0
                const c = b >= a ? color(0) : color(1)
                return (
                  <g key={o.id}>
                    <title>{`${o.name}: ${fmt(a)} → ${fmt(b)}`}</title>
                    <line
                      x1={70}
                      x2={330}
                      y1={y(Math.sqrt(a))}
                      y2={y(Math.sqrt(b))}
                      stroke={c}
                      strokeWidth={2}
                      opacity={0.8}
                    />
                    <circle cx={70} cy={y(Math.sqrt(a))} r={4} fill={c} />
                    <circle cx={330} cy={y(Math.sqrt(b))} r={4} fill={c} />
                  </g>
                )
              })}
              <XLabels
                y={H - 8}
                items={[
                  { x: 70, label: String(before) },
                  { x: 330, label: String(now) },
                ]}
              />
            </Svg>
            <Legend
              items={[
                ['up', color(0)],
                ['down', color(1)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

function OccupationTreemap() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={data}>
      {(m) => {
        const fi = m.fields.map((f) => f.id)
        const cells = squarify(m.occupations, (o) => o.ads[year] ?? 0, {
          x: 0,
          y: 0,
          w: 800,
          h: 380,
        })
        return (
          <>
            <Slicer
              label="Year"
              options={m.years.filter((y) => y < m.latest_year)}
              value={year}
              onChange={setYear}
            />
            <Svg
              w={800}
              h={380}
              label="Treemap of ads by occupation, coloured by field"
            >
              {cells.map((c) => (
                <rect
                  key={c.item.id}
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={color(fi.indexOf(c.item.field))}
                  stroke="var(--paper)"
                  strokeWidth={1}
                  className="mean-job-hover"
                >
                  <title>{`${c.item.name}: ${fmt(c.item.ads[year] ?? 0)} ads`}</title>
                </rect>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-occupation-bars',
    domain: D,
    size: 'tall',
    render: () => <OccupationBars />,
  },
  {
    id: 'job-occupation-treemap',
    domain: D,
    size: 'wide',
    render: () => <OccupationTreemap />,
  },
  { id: 'job-occupation-slope', domain: D, render: () => <OccupationSlope /> },
]
