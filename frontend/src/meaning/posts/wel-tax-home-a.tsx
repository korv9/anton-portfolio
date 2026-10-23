/** Taxes close to home: municipal rates, church fees, household VAT and the tax wedge. */
import { Frame, color, tile, useData, type Post } from '../kit'
import { Kpi, Svg, XTicks, extent, fmt, groupBy, scale } from './wel-kit'

type Municipalities = {
  municipalities: {
    code: string
    name: string
    local_rate: number
    parishes: [string, number, number][]
  }[]
}

const useMun = () => useData<Municipalities>('taxes/municipalities.json')

function RateUnits() {
  const data = useMun()
  return (
    <Frame data={data}>
      {(d) => {
        const bins = groupBy(
          d.municipalities,
          (m) => Math.round(m.local_rate * 4) / 4,
        )
        const keys = [...bins.keys()].sort((a, b) => a - b)
        const x = scale([keys[0], keys[keys.length - 1]], [20, 780])
        return (
          <Svg
            w={800}
            h={400}
            label="Each municipality as one dot, stacked by local income tax rate"
          >
            {keys.map((k) =>
              bins.get(k)!.map((m, i) => (
                <circle
                  key={m.code}
                  cx={x(k)}
                  cy={370 - i * 9}
                  r={4}
                  fill={color(Math.floor(i / 5))}
                >
                  <title>{`${m.name}: ${m.local_rate}%`}</title>
                </circle>
              )),
            )}
            <XTicks
              values={keys.map((k, i) => (i % 4 ? '' : `${k}%`))}
              x={(i) => x(keys[i])}
              y={392}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function RateKpis() {
  const data = useMun()
  return (
    <Frame data={data}>
      {(d) => {
        const r = d.municipalities
          .map((m) => m.local_rate)
          .sort((a, b) => a - b)
        return (
          <div className="mean-wel-grid">
            {[
              r[0],
              r[Math.floor(r.length / 2)],
              r[r.length - 1],
              r[r.length - 1] - r[0],
            ].map((v, i) => (
              <div key={i} style={tile(color(i + 1))}>
                <Kpi value={fmt(v, 2)} unit="%" />
              </div>
            ))}
          </div>
        )
      }}
    </Frame>
  )
}

function ChurchSwarm() {
  const data = useMun()
  return (
    <Frame data={data}>
      {(d) => {
        const fees = d.municipalities.flatMap((m) =>
          m.parishes.map((p) => ({ name: p[0], fee: p[2], burial: p[1] })),
        )
        const [lo, hi] = extent(fees.map((f) => f.fee))
        const x = scale([lo, hi], [10, 390])
        const cols = new Map<number, number>()
        return (
          <Svg label="Church fee of every parish as a dot">
            {fees
              .sort((a, b) => a.fee - b.fee)
              .map((f, i) => {
                const b = Math.round(x(f.fee) / 4)
                const n = cols.get(b) ?? 0
                cols.set(b, n + 1)
                return (
                  <circle
                    key={i}
                    cx={b * 4}
                    cy={200 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 3.6}
                    r={1.7}
                    fill={color(Math.round(f.burial * 10))}
                  >
                    <title>{`${f.name}: ${f.fee}%`}</title>
                  </circle>
                )
              })}
            <XTicks
              values={[`${lo}%`, `${hi}%`]}
              x={(i) => (i ? 375 : 25)}
              y={396}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-rate-units',
    domain: 'taxes',
    sources: ['taxes/municipalities.json'],
    size: 'wide',
    render: () => <RateUnits />,
  },
  {
    id: 'wel-rate-kpis',
    domain: 'taxes',
    sources: ['taxes/municipalities.json'],
    render: () => <RateKpis />,
  },
  {
    id: 'wel-church-swarm',
    domain: 'taxes',
    sources: ['taxes/municipalities.json'],
    render: () => <ChurchSwarm />,
  },
]
