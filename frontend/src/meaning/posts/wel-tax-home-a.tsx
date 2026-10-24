/** Municipal income tax rates: how far they spread. */
import { Frame, OTHER, focal, useData, type Post } from '../kit'
import { XAxis, YAxis } from '../axes'
import { Svg, axis, fmt, num, scale } from './wel-kit'

type Municipalities = {
  year: string | number
  municipalities: { code: string; name: string; local_rate: number }[]
}

/** Bin width in percentage points. */
const BIN = 0.25

const rates = (d: Municipalities) =>
  d.municipalities
    .map((m) => m.local_rate)
    .filter(num)
    .sort((a, b) => a - b)

const median = (v: number[]) =>
  v.length % 2
    ? v[(v.length - 1) / 2]
    : (v[v.length / 2 - 1] + v[v.length / 2]) / 2

const rate = (v: number) => `${fmt(v, 2)}%`

function RateHistogram() {
  return (
    <Frame data={useData<Municipalities>('taxes/municipalities.json')}>
      {(d) => {
        const v = rates(d)
        if (!v.length) return null
        const lo = Math.floor(v[0] / BIN) * BIN
        const hi = Math.ceil((v.at(-1)! + 1e-9) / BIN) * BIN
        const bins = Array.from(
          { length: Math.round((hi - lo) / BIN) },
          (_, i) => lo + i * BIN,
        )
        const counts = bins.map(
          (b) => v.filter((r) => r >= b && r < b + BIN).length,
        )
        const x = scale([lo, hi], [36, 590])
        const ay = axis(counts, [190, 22])
        const mid = median(v)
        const w = x(lo + BIN) - x(lo)
        return (
          <Svg
            w={600}
            h={220}
            label={`Municipal income tax rates in ${BIN}-point bins, number of municipalities; median ${rate(mid)}`}
          >
            <YAxis y={ay.y} ticks={ay.ticks} x0={36} x1={590} />
            {bins.map((b, i) => (
              <rect
                key={b}
                x={x(b) + 0.5}
                y={ay.y(counts[i])}
                width={w - 1}
                height={ay.y(0) - ay.y(counts[i])}
                fill={OTHER}
              >
                <title>{`${rate(b)}–${rate(b + BIN)}: ${counts[i]} municipalities`}</title>
              </rect>
            ))}
            <line
              x1={x(mid)}
              x2={x(mid)}
              y1={14}
              y2={190}
              stroke={focal(true)}
              strokeWidth={1.6}
            />
            <text x={x(mid) + 4} y={14} className="mean-wel-name">
              Median {rate(mid)}
            </text>
            <XAxis
              x={x}
              y={206}
              ticks={bins
                .filter((b) => Math.abs(b - Math.round(b)) < 1e-9)
                .map((b) => ({ value: b, label: `${b}%` }))}
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
    title: (d: Municipalities) => {
      const v = rates(d)
      return v.length
        ? `Municipal income tax ranged from ${rate(v[0])} to ${rate(v.at(-1)!)} in ${d.year}`
        : 'Municipal income tax rates'
    },
    note: 'Municipalities per quarter-point band; municipal plus regional rate. Source: Skatteverket',
    render: () => <RateHistogram />,
  },
]
