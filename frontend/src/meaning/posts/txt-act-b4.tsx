/** AI signals outside the Act: monthly counts in Riksdag speeches and job ads. */
import { Frame, PALETTE, useData, type Post } from '../kit'
import { Svg, fmt, uniq, usable } from './txt-kit'

type Signals = {
  series: {
    series_id: string
    label_en: string
    rows: [string, number, number, number, number][]
  }[]
}
const SIG = 'ai-act/signals.json'
function SignalMultiples() {
  const data = usable(
    useData<Signals>(SIG),
    SIG,
    (d) => d.series.length && d.series.every((s) => s.rows.length),
  )
  return (
    <Frame data={data}>
      {({ series }) => {
        const [W, rh] = [400, 76]
        // One month axis for every panel, so the Riksdag series (from 2016) and the job-ad
        // series (from 2020) line up in time.
        const months = uniq(
          series.flatMap((s) => s.rows.map((r) => r[0])),
        ).sort()
        const bw = W / months.length
        return (
          <Svg
            w={W}
            h={rh * series.length + 14}
            label="Monthly counts of every AI signal, small multiples"
          >
            {series.map((s, j) => {
              const max = Math.max(...s.rows.map((r) => r[1]), 1)
              return (
                <g key={s.series_id} transform={`translate(0,${j * rh})`}>
                  <text className="mean-txt-t" x={0} y={10}>
                    {s.label_en}
                  </text>
                  <text className="mean-txt-t" x={W} y={10} textAnchor="end">
                    {fmt(max)}
                  </text>
                  {s.rows.map((r) => (
                    <rect
                      key={r[0]}
                      x={months.indexOf(r[0]) * bw}
                      width={Math.max(bw - 0.6, 0.4)}
                      y={rh - 4 - ((rh - 14) * r[1]) / max}
                      height={((rh - 14) * r[1]) / max}
                      fill={PALETTE[0]}
                    >
                      <title>{`${r[0]}: ${fmt(r[1])}`}</title>
                    </rect>
                  ))}
                </g>
              )
            })}
            {/* First and last month under the bottom panel: the axis every panel shares. */}
            <text className="mean-txt-t" x={0} y={rh * series.length + 11}>
              {months[0]}
            </text>
            <text
              className="mean-txt-t"
              x={W}
              y={rh * series.length + 11}
              textAnchor="end"
            >
              {months[months.length - 1]}
            </text>
          </Svg>
        )
      }}
    </Frame>
  )
}

const d = 'ai-act'
export const posts: Post[] = [
  {
    id: 'txt-act-signal-multiples',
    domain: d,
    sources: ['ai-act/signals.json'],
    size: 'tall',
    title: 'AI in Riksdag speeches and job ads, by month',
    note: 'Each panel on its own scale; all panels share the month axis',
    render: () => <SignalMultiples />,
  },
]
