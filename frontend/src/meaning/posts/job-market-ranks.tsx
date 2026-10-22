/** Jobs: occupations and fields, from market.json's yearly occupation and monthly field counts. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  compact,
  D,
  fieldName,
  fmt,
  Legend,
  linePath,
  MARKET,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

/** Ads per field in the months the latest year covers, so every year compares alike. */
const ytdByField = (m: Market, year: number) =>
  m.fields.map((f) => ({
    id: f.id,
    name: fieldName(f.name),
    ads: sum(
      (m.monthly[f.id] ?? [])
        .filter(
          (r) =>
            Number(r[0].slice(0, 4)) === year &&
            Number(r[0].slice(5, 7)) <= m.ytd_months,
        )
        .map((r) => r[1]),
    ),
  }))

function FieldBump() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const ranks = m.years.map((yr) =>
          ytdByField(m, yr)
            .sort((a, b) => b.ads - a.ads)
            .map((f) => f.id),
        )
        const shown = ranks.at(-1)!.slice(0, 10)
        const W = 800,
          H = 380,
          n = 12
        const x = linearScale([0, m.years.length - 1], [30, W - 30])
        const y = (r: number) => 20 + (r / (n - 1)) * (H - 50)
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Bump chart of field rank by ads, same months each year"
            >
              {shown.map((id, k) => {
                const pts = ranks.map(
                  (r, i) =>
                    [x(i), y(Math.min(r.indexOf(id), n - 1))] as [
                      number,
                      number,
                    ],
                )
                const name = fieldName(
                  m.fields.find((f) => f.id === id)?.name ?? id,
                )
                return (
                  <g key={id}>
                    <title>{name}</title>
                    <path
                      d={linePath(pts)}
                      fill="none"
                      stroke={color(k)}
                      strokeWidth={6}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {pts.map(([px, py], i) => (
                      <circle
                        key={i}
                        cx={px}
                        cy={py}
                        r={8}
                        fill={color(k)}
                        stroke="var(--paper)"
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                )
              })}
              <XLabels
                y={H - 6}
                items={m.years.map((yr, i) => ({ x: x(i), label: String(yr) }))}
              />
            </Svg>
            <Legend
              items={shown.map((id, k) => [
                fieldName(m.fields.find((f) => f.id === id)?.name ?? id),
                color(k),
              ])}
            />
          </>
        )
      }}
    </Frame>
  )
}

function FieldRadial() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2026)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = ytdByField(m, year)
          .sort((a, b) => b.ads - a.ads)
          .slice(0, 14)
        const max = Math.max(1, ...rows.map((r) => r.ads))
        const cx = 200,
          cy = 200,
          step = 12
        return (
          <>
            <Slicer
              label="Year"
              options={m.years}
              value={year}
              onChange={setYear}
            />
            <Svg w={400} h={400} label="Radial bars of ads per field">
              {rows.map((r, i) => {
                const rad = 190 - i * step
                const a = (r.ads / max) * 1.5 * Math.PI
                const large = a > Math.PI ? 1 : 0
                const ex = cx + rad * Math.sin(a),
                  ey = cy - rad * Math.cos(a)
                return (
                  <g key={r.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rad}
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth={step - 3}
                    />
                    <path
                      d={`M${cx},${cy - rad}A${rad},${rad} 0 ${large} 1 ${ex},${ey}`}
                      fill="none"
                      stroke={color(i)}
                      strokeWidth={step - 3}
                      strokeLinecap="round"
                    >
                      <title>{`${r.name}: ${fmt(r.ads)} ads`}</title>
                    </path>
                  </g>
                )
              })}
              <text
                x={cx}
                y={cy + 6}
                textAnchor="middle"
                fontSize={22}
                fontWeight={700}
              >
                {compact(sum(ytdByField(m, year).map((r) => r.ads)))}
              </text>
              <text x={cx} y={cy + 22} textAnchor="middle" fontSize={10}>
                ads
              </text>
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function FieldChange() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const now = ytdByField(m, m.latest_year)
        const prev = ytdByField(m, m.latest_year - 1)
        const rows = now
          .map((f, i) => ({
            ...f,
            ch: prev[i].ads ? f.ads / prev[i].ads - 1 : 0,
          }))
          .sort((a, b) => b.ch - a.ch)
        const lim = Math.max(...rows.map((r) => Math.abs(r.ch)))
        const W = 400,
          rowH = 18,
          mid = 200
        const x = linearScale([-lim, lim], [20, W - 20])
        return (
          <Svg
            w={W}
            h={rows.length * rowH + 10}
            label="Change in ads per field against the same months last year"
          >
            <line
              x1={mid}
              x2={mid}
              y1={0}
              y2={rows.length * rowH}
              stroke="var(--line-strong)"
            />
            {rows.map((r, j) => (
              <g key={r.id}>
                <title>{`${r.name}: ${(r.ch * 100).toFixed(1)} %`}</title>
                <rect
                  x={Math.min(mid, x(r.ch))}
                  y={j * rowH + 2}
                  width={Math.abs(x(r.ch) - mid)}
                  height={rowH - 4}
                  rx={3}
                  fill={r.ch >= 0 ? color(4) : color(1)}
                />
                <text
                  x={r.ch >= 0 ? mid - 4 : mid + 4}
                  y={j * rowH + rowH / 2 + 3}
                  textAnchor={r.ch >= 0 ? 'end' : 'start'}
                  fontSize={9}
                >
                  {`${r.ch >= 0 ? '+' : ''}${(r.ch * 100).toFixed(0)} %`}
                </text>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-field-bump',
    domain: D,
    size: 'wide',
    render: () => <FieldBump />,
  },
  { id: 'job-field-radial', domain: D, render: () => <FieldRadial /> },
  { id: 'job-field-change', domain: D, render: () => <FieldChange /> },
]
