/** European Social Survey means (the trust gauges live in wel-ess-gauges.tsx). */
import { useState } from 'react'
import { Frame, Slicer, color, focal, useData, type Post } from '../kit'
import { Legend, Svg, XTicks, fmt, num, path, scale } from './wel-kit'

type Ess = { unit_code: string; period_key: string } & Record<
  string,
  number | string | null
>

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
              cycles
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
              {/* Sweden is the focal line, drawn last so it sits on top; the rest are grey. */}
              {[...UNITS].reverse().map((u) => {
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
                      stroke={focal(u === 'SE')}
                      strokeWidth={u === 'SE' ? 4 : 1.6}
                    />
                    {pts.map(([cx, cy]) => (
                      <circle
                        key={cx}
                        cx={cx}
                        cy={cy}
                        r={u === 'SE' ? 5 : 3}
                        fill={focal(u === 'SE')}
                      />
                    ))}
                    {u === 'SE' && pts.length > 0 && (
                      <text
                        x={pts.at(-1)![0]}
                        y={pts.at(-1)![1] - 14}
                        textAnchor="end"
                        fontSize={22}
                        fontWeight={700}
                        stroke="var(--paper)"
                        strokeWidth={4}
                        paintOrder="stroke"
                        style={{ fill: 'var(--mean-ink)' }}
                      >
                        Sweden
                      </text>
                    )}
                  </g>
                )
              })}
              <XTicks
                values={Array.from({ length: 11 }, (_, i) => i + 1)}
                x={(i) => x(i + 1)}
                y={392}
              />
            </Svg>
            <Legend
              items={['Sweden', 'Other countries and groups']}
              colors={[focal(true), focal(false)]}
            />
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

export const posts: Post[] = [
  {
    id: 'wel-ess-radar',
    domain: 'welfare',
    sources: ['welfare/ess-countries.json'],
    render: () => <Radar />,
  },
  {
    id: 'wel-ess-lines',
    domain: 'welfare',
    sources: ['welfare/ess-countries.json'],
    size: 'wide',
    render: () => <RoundLines />,
  },
  {
    id: 'wel-ess-heat',
    domain: 'welfare',
    sources: ['welfare/ess-countries.json'],
    render: () => <EssHeat />,
  },
]
