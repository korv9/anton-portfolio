/** European Social Survey means by round (the trust bars live in wel-ess-gauges.tsx). */
import { useState } from 'react'
import { Frame, Slicer, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Svg, extent, num, path, scale } from './wel-kit'

type Ess = {
  unit_code: string
  period_key: string
  reference_year: number
} & Record<string, number | string | null>

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
const METRICS = Object.keys(ESS_NAMES)

const UNITS: Record<string, string> = {
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  DE: 'Germany',
  NORDIC: 'Nordic',
  EU27: 'EU27',
}

const val = (r: Ess | undefined, m: string) =>
  r && num(r[`${m}_mean`]) ? (r[`${m}_mean`] as number) : null

const latestRound = (rows: Ess[]) =>
  Math.max(...rows.map((r) => r.reference_year))

/** On how many measures Sweden's latest mean is above the EU27's. */
function aboveEu(rows: Ess[]) {
  const y = latestRound(rows)
  const at = (u: string) =>
    rows.find((r) => r.unit_code === u && r.reference_year === y)
  const both = METRICS.filter(
    (m) => num(val(at('SE'), m)) && num(val(at('EU27'), m)),
  )
  const above = both.filter((m) => val(at('SE'), m)! > val(at('EU27'), m)!)
  return { y, above: above.length, of: both.length }
}

function RoundLines() {
  const data = useData<Ess[]>('welfare/ess-countries.json')
  const [m, setM] = useState('ppltrst')
  return (
    <Frame data={data}>
      {(rows) => {
        const [y0, y1] = extent(rows.map((r) => r.reference_year))
        const x = scale([y0, y1], [28, 520])
        const y = scale([0, 10], [200, 12])
        const lines = Object.keys(UNITS).map((u) => ({
          u,
          pts: rows
            .filter((r) => r.unit_code === u && num(val(r, m)))
            .sort((a, b) => a.reference_year - b.reference_year),
        }))
        // Sweden is the focal line, drawn last so it sits on top; the rest are grey.
        const order = [...lines].reverse()
        const ends = lines.filter((l) => l.pts.at(-1)?.reference_year === y1)
        return (
          <>
            <Slicer
              label="Survey measure"
              options={METRICS}
              format={(k) => ESS_NAMES[k]}
              value={m}
              onChange={setM}
            />
            <Svg
              w={600}
              h={220}
              label={`${ESS_NAMES[m]}, mean on a 0 to 10 scale by survey year`}
            >
              <YAxis y={y} ticks={[0, 2, 4, 6, 8, 10]} x0={28} x1={520} />
              {order.map(({ u, pts }) => (
                <path
                  key={u}
                  d={path(pts.map((r) => [x(r.reference_year), y(val(r, m)!)]))}
                  fill="none"
                  stroke={focal(u === 'SE')}
                  strokeWidth={u === 'SE' ? 2.5 : 1.2}
                />
              ))}
              <EndLabels
                x={526}
                top={12}
                bottom={200}
                items={ends.map(({ u, pts }) => ({
                  y: y(val(pts.at(-1), m)!),
                  label: UNITS[u],
                  color: u === 'SE' ? undefined : 'var(--mean-muted)',
                }))}
              />
              <XAxis
                x={x}
                y={216}
                ticks={[...new Set(rows.map((r) => r.reference_year))]
                  .sort()
                  .filter((v) => (v - y0) % 6 === 0 || v === y1)
                  .map((v) => ({ value: v, label: String(v) }))}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-ess-lines',
    domain: 'welfare',
    sources: ['welfare/ess-countries.json'],
    size: 'wide',
    title: (rows: Ess[]) => {
      const a = aboveEu(rows)
      const n = a.above === a.of ? `all ${a.of}` : `${a.above} of ${a.of}`
      return `In ${a.y}, Sweden was above the EU27 average on ${n} survey measures`
    },
    note: 'Shown: trust in other people, mean on a 0–10 scale. Source: European Social Survey',
    render: () => <RoundLines />,
  },
]
