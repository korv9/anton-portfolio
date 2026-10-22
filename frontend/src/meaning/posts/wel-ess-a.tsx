/** European Social Survey means and the latest welfare headline figures. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Legend, Svg, XTicks, arc, fmt, num, path, scale } from './wel-kit'

type Ess = { unit_code: string; period_key: string } & Record<
  string,
  number | string | null
>

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
  previous_period_label: string | null
}

const METRICS = [
  'ppltrst',
  'trstprl',
  'trstplt',
  'trstplc',
  'trstlgl',
  'stflife',
  'happy',
  'stfdem',
  'stfeco',
  'sclmeet',
  'imwbcnt',
]

/** ESS item codes in plain words. */
const ESS_NAMES: Record<string, string> = {
  ppltrst: 'Trust in people',
  trstprl: 'Trust in parliament',
  trstplt: 'Trust in politicians',
  trstplc: 'Trust in the police',
  trstlgl: 'Trust in the legal system',
  stflife: 'Life satisfaction',
  happy: 'Happiness',
  stfdem: 'Satisfaction with democracy',
  stfeco: 'Satisfaction with the economy',
  sclmeet: 'Meets friends socially',
  imwbcnt: 'Immigrants make the country better',
}
const essName = (m: string) => ESS_NAMES[m] ?? m

const UNITS = ['SE', 'NO', 'DK', 'FI', 'DE', 'NORDIC', 'EU27']

const round = (p: string) => +p.replace('ESS', '')

const useEss = () => useData<Ess[]>('welfare/ess-countries.json')

const useHeadlines = () => useData<Headline[]>('welfare/headlines.json')

const val = (r: Ess | undefined, m: string) =>
  r && num(r[`${m}_mean`]) ? (r[`${m}_mean`] as number) : null

function Radar() {
  const data = useEss()
  const [p, setP] = useState(11)
  return (
    <Frame data={data}>
      {(rows) => {
        const units = ['SE', 'NORDIC', 'EU27', 'DE']
        const rounds = [...new Set(rows.map((r) => round(r.period_key)))].sort(
          (a, b) => a - b,
        )
        const n = METRICS.length
        const pt = (i: number, v: number) => {
          const a = (i / n) * 2 * Math.PI
          return [200 + Math.sin(a) * v * 18, 200 - Math.cos(a) * v * 18] as [
            number,
            number,
          ]
        }
        return (
          <>
            <Slicer
              label="Survey round"
              options={rounds}
              format={(r) => `ESS round ${r}`}
              value={p}
              onChange={setP}
            />
            <Svg label="Radar of survey means, Sweden against comparison groups">
              {[2, 4, 6, 8, 10].map((v) => (
                <path
                  key={v}
                  d={`${path(METRICS.map((_, i) => pt(i, v)))}Z`}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={0.4}
                />
              ))}
              {units.map((u, j) => {
                const r = rows.find(
                  (x) => x.unit_code === u && round(x.period_key) === p,
                )
                const pts = METRICS.map((m, i) => pt(i, val(r, m) ?? 0))
                return r ? (
                  <path
                    key={u}
                    d={`${path(pts)}Z`}
                    fill={color(j)}
                    fillOpacity={0.25}
                    stroke={color(j)}
                    strokeWidth={1.6}
                  />
                ) : null
              })}
              {METRICS.map((m, i) => {
                const [x, y] = pt(i, 11)
                return (
                  <text key={m} x={x} y={y + 3} textAnchor="middle">
                    {m}
                  </text>
                )
              })}
            </Svg>
            <Legend items={units} />
          </>
        )
      }}
    </Frame>
  )
}

function RoundLines() {
  const data = useEss()
  const [m, setM] = useState('ppltrst')
  return (
    <Frame data={data}>
      {(rows) => {
        const x = scale([1, 11], [30, 780])
        const vs = rows.map((r) => val(r, m)).filter(num)
        const y = scale(
          [Math.floor(Math.min(...vs)), Math.ceil(Math.max(...vs))],
          [370, 20],
        )
        return (
          <>
            <Slicer
              label="Survey measure"
              cycles={false}
              options={METRICS}
              format={essName}
              value={m}
              onChange={setM}
            />
            <Svg
              w={800}
              h={400}
              label="Survey means by round for seven countries and groups"
            >
              {UNITS.map((u, j) => {
                const pts = rows
                  .filter((r) => r.unit_code === u && num(val(r, m)))
                  .sort((a, b) => round(a.period_key) - round(b.period_key))
                  .map(
                    (r) =>
                      [x(round(r.period_key)), y(val(r, m)!)] as [
                        number,
                        number,
                      ],
                  )
                return (
                  <g key={u}>
                    <path
                      d={path(pts)}
                      fill="none"
                      stroke={color(j)}
                      strokeWidth={u === 'SE' ? 4 : 1.6}
                    />
                    {pts.map(([cx, cy]) => (
                      <circle
                        key={cx}
                        cx={cx}
                        cy={cy}
                        r={u === 'SE' ? 5 : 3}
                        fill={color(j)}
                      />
                    ))}
                  </g>
                )
              })}
              <XTicks
                values={Array.from({ length: 11 }, (_, i) => i + 1)}
                x={(i) => x(i + 1)}
                y={392}
              />
            </Svg>
            <Legend items={UNITS} />
          </>
        )
      }}
    </Frame>
  )
}

function EssHeat() {
  const data = useEss()
  return (
    <Frame data={data}>
      {(rows) => {
        const se = rows.filter((r) => r.unit_code === 'SE')
        const cw = 340 / 11
        const ch = 370 / METRICS.length
        return (
          <Svg label="Sweden's survey means, measure by round">
            {METRICS.map((m, i) =>
              se.map((r) => {
                const v = val(r, m)
                return num(v) ? (
                  <rect
                    key={m + r.period_key}
                    x={56 + (round(r.period_key) - 1) * cw}
                    y={i * ch}
                    width={cw - 1.5}
                    height={ch - 1.5}
                    rx={3}
                    fill={`color-mix(in srgb, var(--cv-olive) ${Math.round(v * 10)}%, var(--cluster-butter))`}
                  >
                    <title>{`${essName(m)}, ESS round ${round(r.period_key)}: ${fmt(v, 2)}`}</title>
                  </rect>
                ) : null
              }),
            )}
            {METRICS.map((m, i) => (
              <text key={m} x={52} y={i * ch + ch / 2 + 3} textAnchor="end">
                {m}
              </text>
            ))}
            <XTicks
              values={Array.from({ length: 11 }, (_, i) => i + 1)}
              x={(i) => 56 + i * cw + cw / 2}
              y={392}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function Gauges() {
  const data = useHeadlines()
  return (
    <Frame data={data}>
      {(rows) => {
        const keys = [
          'ess_trstplc',
          'ess_trstlgl',
          'ess_trstprl',
          'ess_trstplt',
        ]
        const half = Math.PI / 2
        return (
          <>
            <Svg label="Four trust gauges on a 0 to 10 scale">
              {keys.map((k, i) => {
                const h = rows.find((r) => r.indicator_key === k)
                if (!h) return null
                const cx = 100 + (i % 2) * 200
                const cy = 150 + Math.floor(i / 2) * 190
                return (
                  <g key={k}>
                    <path
                      d={arc(cx, cy, 58, 86, -half, half)}
                      fill="var(--wash)"
                    />
                    <path
                      d={arc(
                        cx,
                        cy,
                        58,
                        86,
                        -half,
                        -half + (h.value / 10) * Math.PI,
                      )}
                      fill={color(i)}
                    />
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      style={{ fontSize: 26, fill: 'var(--ink)' }}
                    >
                      {fmt(h.value, 1)}
                    </text>
                  </g>
                )
              })}
            </Svg>
            <Legend items={keys.map((k) => k.slice(4))} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'wel-ess-radar', domain: 'welfare', render: () => <Radar /> },
  {
    id: 'wel-ess-lines',
    domain: 'welfare',
    size: 'wide',
    render: () => <RoundLines />,
  },
  { id: 'wel-ess-heat', domain: 'welfare', render: () => <EssHeat /> },
  { id: 'wel-trust-gauges', domain: 'welfare', render: () => <Gauges /> },
]
