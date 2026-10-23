/** European Social Survey means and the latest welfare headline figures. */
import { Frame, color, useData, type Post } from '../kit'
import { Kpi, Svg, XTicks, arc, fmt, num, scale } from './wel-kit'

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
  previous_period_label: string | null
}

type Indicator = { indicator_key: string; unit: string | null }

const useHeadlines = () => useData<Headline[]>('welfare/headlines.json')

function RadialBars() {
  const data = useHeadlines()
  return (
    <Frame data={data}>
      {(rows) => {
        const ess = rows.filter(
          (r) =>
            r.indicator_key.startsWith('ess_') &&
            r.indicator_key !== 'ess_health',
        )
        const step = (2 * Math.PI) / ess.length
        return (
          <Svg label="Radial bars of the latest survey means">
            {ess.map((r, i) => (
              <path
                key={r.indicator_key}
                d={arc(
                  200,
                  200,
                  50,
                  50 + r.value * 14,
                  i * step + 0.02,
                  (i + 1) * step - 0.02,
                )}
                fill={color(i)}
              >
                <title>{`${r.indicator_key.slice(4)}: ${fmt(r.value, 2)}`}</title>
              </path>
            ))}
            <text
              x={200}
              y={206}
              textAnchor="middle"
              style={{ fontSize: 16, fill: 'var(--ink)' }}
            >
              0–10
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

function EssSlope() {
  const data = useHeadlines()
  return (
    <Frame data={data}>
      {(rows) => {
        const ess = rows.filter(
          (r) =>
            r.indicator_key.startsWith('ess_') &&
            num(r.previous_value) &&
            r.indicator_key !== 'ess_health',
        )
        const vs = ess.flatMap((r) => [r.value, r.previous_value!])
        const y = scale(
          [Math.floor(Math.min(...vs)), Math.ceil(Math.max(...vs))],
          [380, 20],
        )
        return (
          <Svg label="Survey means, previous round against latest">
            {ess.map((r, i) => (
              <g key={r.indicator_key}>
                <line
                  x1={110}
                  x2={290}
                  y1={y(r.previous_value!)}
                  y2={y(r.value)}
                  stroke={color(i)}
                  strokeWidth={2.2}
                />
                <circle
                  cx={110}
                  cy={y(r.previous_value!)}
                  r={4}
                  fill={color(i)}
                />
                <circle cx={290} cy={y(r.value)} r={4} fill={color(i)} />
                <text x={296} y={y(r.value) + 3}>
                  {r.indicator_key.slice(4)}
                </text>
              </g>
            ))}
            <XTicks
              values={[
                ess[0]?.previous_period_label?.split(' ')[0] ?? '',
                ess[0]?.period_label.split(' ')[0] ?? '',
              ]}
              x={(i) => (i ? 290 : 110)}
              y={396}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function AkuGrid() {
  const data = useHeadlines()
  return (
    <Frame data={data}>
      {(rows) => (
        <div className="mean-wel-grid">
          {rows
            .filter(
              (r) =>
                r.indicator_key.startsWith('aku_') ||
                r.indicator_key.startsWith('fk_'),
            )
            .map((r) => (
              <div key={r.indicator_key}>
                <Kpi
                  value={fmt(r.value)}
                  unit={r.indicator_key.startsWith('aku_') ? '%' : undefined}
                  delta={
                    num(r.previous_value)
                      ? r.value - r.previous_value
                      : undefined
                  }
                />
              </div>
            ))}
        </div>
      )}
    </Frame>
  )
}

function Population() {
  const data = useHeadlines()
  return (
    <Frame data={data}>
      {(rows) => {
        const h = rows.find((r) => r.indicator_key === 'scb_population')
        return h ? (
          <Kpi
            value={h.value.toLocaleString('en-GB')}
            unit="people"
            delta={
              num(h.previous_value) ? h.value - h.previous_value : undefined
            }
          />
        ) : null
      }}
    </Frame>
  )
}

function Waffles() {
  const data = useHeadlines()
  const units = useData<Indicator[]>('welfare/indicators.json')
  return (
    <Frame data={data}>
      {(rows) => (
        <Frame data={units}>
          {(inds) => {
            const pct = new Set(
              inds
                .filter((d) => d.unit === 'procent')
                .map((d) => d.indicator_key),
            )
            const list = rows.filter(
              (r) => pct.has(r.indicator_key) && r.value <= 100,
            )
            const cols = 6
            const s = 6
            return (
              <Svg
                w={400}
                h={540}
                label="One hundred-cell waffle per public health share"
              >
                {list.map((r, k) => {
                  const ox = (k % cols) * 66 + 4
                  const oy = Math.floor(k / cols) * 76 + 4
                  return (
                    <g key={r.indicator_key}>
                      <title>{`${fmt(r.value)}%`}</title>
                      {Array.from({ length: 100 }, (_, c) => (
                        <rect
                          key={c}
                          x={ox + (c % 10) * s}
                          y={oy + Math.floor(c / 10) * s}
                          width={s - 0.8}
                          height={s - 0.8}
                          fill={
                            c < Math.round(r.value) ? color(k) : 'var(--wash)'
                          }
                        />
                      ))}
                    </g>
                  )
                })}
              </Svg>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-population-kpi',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    render: () => <Population />,
  },
  {
    id: 'wel-headline-waffles',
    domain: 'welfare',
    sources: ['welfare/headlines.json', 'welfare/indicators.json'],
    size: 'tall',
    render: () => <Waffles />,
  },
  {
    id: 'wel-aku-grid',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    size: 'wide',
    render: () => <AkuGrid />,
  },
  {
    id: 'wel-ess-radial',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    render: () => <RadialBars />,
  },
  {
    id: 'wel-ess-slope',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    render: () => <EssSlope />,
  },
]
