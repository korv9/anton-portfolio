/** AI Act duties, actors, cross-references and outside signals: heatmap, donut, flows, arcs, lines. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Legend, Svg, fmt, pct, uniq } from './txt-kit'

type Signals = {
  series: {
    series_id: string
    label_en: string
    rows: [string, number, number, number, number][]
  }[]
}
const SIG = 'ai-act/signals.json'
const mix = (c: string, p: number) =>
  `color-mix(in srgb, ${c} ${Math.round(p)}%, var(--paper))`

function SignalCalendar() {
  const data = useData<Signals>(SIG)
  const [sid, setSid] = useState('riksdag_ai')
  return (
    <Frame data={data}>
      {({ series }) => {
        const s = series.find((x) => x.series_id === sid) ?? series[0]
        const yrs = uniq(s.rows.map((r) => r[0].slice(0, 4)))
        const max = Math.max(...s.rows.map((r) => r[3]), 1e-9)
        const [W, m] = [400, 30]
        const cw = (W - m) / 12
        return (
          <>
            <Slicer
              label="Series"
              cycles={false}
              options={series.map((x) => x.series_id)}
              format={(id) =>
                series.find((x) => x.series_id === id)?.label_en ?? id
              }
              value={s.series_id}
              onChange={setSid}
            />
            <Svg
              w={W}
              h={yrs.length * cw + 12}
              label={`${s.label_en}, by month`}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <text
                  key={i}
                  className="mean-txt-t"
                  x={m + (i + 0.5) * cw}
                  y={yrs.length * cw + 10}
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              ))}
              {yrs.map((yr, j) => (
                <text
                  key={yr}
                  className="mean-txt-t"
                  x={m - 3}
                  y={(j + 0.5) * cw + 3}
                  textAnchor="end"
                >
                  {yr}
                </text>
              ))}
              {s.rows.map((r) => (
                <rect
                  key={r[0]}
                  x={m + (+r[0].slice(5) - 1) * cw + 1}
                  y={yrs.indexOf(r[0].slice(0, 4)) * cw + 1}
                  width={cw - 2}
                  height={cw - 2}
                  rx={4}
                  fill={
                    r[1] ? mix(color(1), 15 + (85 * r[3]) / max) : 'var(--wash)'
                  }
                >
                  <title>{`${r[0]}: ${fmt(r[1])} / ${fmt(r[2])} (${pct(r[3])})`}</title>
                </rect>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}
function SignalMultiples() {
  const data = useData<Signals>(SIG)
  return (
    <Frame data={data}>
      {({ series }) => {
        const [W, rh] = [400, 76]
        return (
          <>
            <Svg
              w={W}
              h={rh * series.length}
              label="Monthly counts of every AI signal, small multiples"
            >
              {series.map((s, j) => {
                const max = Math.max(...s.rows.map((r) => r[1]), 1)
                const bw = W / s.rows.length
                return (
                  <g key={s.series_id} transform={`translate(0,${j * rh})`}>
                    <text className="mean-txt-t" x={W} y={10} textAnchor="end">
                      {fmt(max)}
                    </text>
                    {s.rows.map((r, i) => (
                      <rect
                        key={r[0]}
                        x={i * bw}
                        width={Math.max(bw - 0.6, 0.4)}
                        y={rh - 4 - ((rh - 14) * r[1]) / max}
                        height={((rh - 14) * r[1]) / max}
                        fill={color(j)}
                      >
                        <title>{`${r[0]}: ${fmt(r[1])}`}</title>
                      </rect>
                    ))}
                  </g>
                )
              })}
            </Svg>
            <Legend items={series.map((s, j) => [s.label_en, color(j)])} />
          </>
        )
      }}
    </Frame>
  )
}

const d = 'ai-act'
export const posts: Post[] = [
  {
    id: 'txt-act-signal-calendar',
    domain: d,
    size: 'tall',
    render: () => <SignalCalendar />,
  },
  {
    id: 'txt-act-signal-multiples',
    domain: d,
    size: 'tall',
    render: () => <SignalMultiples />,
  },
]
