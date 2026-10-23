/** The latest trust figures from the welfare headlines, as four gauges on a 0 to 10 scale. */
import { Frame, color, useData, type Post } from '../kit'
import { Legend, Svg, arc, fmt } from './wel-kit'

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
  previous_period_label: string | null
}

const NAMES: Record<string, string> = {
  ess_trstplc: 'Police',
  ess_trstlgl: 'Legal system',
  ess_trstprl: 'Parliament',
  ess_trstplt: 'Politicians',
}

const useHeadlines = () => useData<Headline[]>('welfare/headlines.json')

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
            <Legend items={keys.map((k) => NAMES[k])} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-trust-gauges',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    render: () => <Gauges />,
  },
]
