/** AI Act duties, actors, cross-references and outside signals: heatmap, donut, flows, arcs, lines. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Legend, Svg, line, palette, uniq } from './txt-kit'

type Article = {
  article_number: string
  article_sort: number
  chapter: string
  char_count: number
  change_type: string
  applies_from: string | null
  refers_to: string[]
  actors: string[]
}
type Signals = {
  series: {
    series_id: string
    label_en: string
    rows: [string, number, number, number, number][]
  }[]
}
const SIG = 'ai-act/signals.json'
const d = 'ai-act'

function ReferenceArcs() {
  const data = useData<Article[]>('ai-act/articles.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const arts = [...rows].sort((a, b) => a.article_sort - b.article_sort)
        const idx = new Map(arts.map((a, i) => [a.article_number, i]))
        const chapters = palette(uniq(arts.map((a) => a.chapter)))
        const [W, H] = [600, 300]
        const x = (i: number) => 6 + (i * (W - 12)) / (arts.length - 1)
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Cross-references between AI Act articles as arcs"
            >
              {arts.flatMap((a) =>
                a.refers_to
                  .filter((r) => idx.has(r))
                  .map((r) => {
                    const [x0, x1] = [
                      x(idx.get(a.article_number)!),
                      x(idx.get(r)!),
                    ]
                    const rad = Math.abs(x1 - x0) / 2
                    return (
                      <path
                        key={`${a.article_number}-${r}`}
                        d={`M${x0},${H - 8}A${rad},${Math.min(rad, H - 12)} 0 0 ${x1 > x0 ? 1 : 0} ${x1},${H - 8}`}
                        fill="none"
                        stroke={chapters.get(a.chapter)}
                        strokeOpacity={0.5}
                        strokeWidth={0.8}
                      />
                    )
                  }),
              )}
              {arts.map((a, i) => (
                <circle
                  key={a.article_number}
                  cx={x(i)}
                  cy={H - 6}
                  r={2}
                  fill={chapters.get(a.chapter)}
                >
                  <title>{a.article_number}</title>
                </circle>
              ))}
            </Svg>
            <Legend items={[...chapters]} />
          </>
        )
      }}
    </Frame>
  )
}
function SignalLine() {
  const data = useData<Signals>(SIG)
  const [sid, setSid] = useState('jobs_ai_any')
  return (
    <Frame data={data}>
      {({ series }) => {
        const s = series.find((x) => x.series_id === sid) ?? series[0]
        const [W, H, m] = [600, 260, 34]
        const max = Math.max(...s.rows.map((r) => r[3]), 1e-9)
        const ticks = niceTicks(max * 100).map((t) => t / 100)
        const y = linearScale([0, ticks.at(-1)!], [H - 14, 6])
        const x = (i: number) => m + (i * (W - m)) / (s.rows.length - 1)
        const pts = (j: 3 | 4) =>
          s.rows.map((r, i) => [x(i), y(r[j])] as [number, number])
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
            <Svg w={W} h={H} label={s.label_en}>
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    className="mean-txt-grid"
                    x1={m}
                    x2={W}
                    y1={y(t)}
                    y2={y(t)}
                  />
                  <text
                    className="mean-txt-t"
                    x={m - 3}
                    y={y(t) + 3}
                    textAnchor="end"
                  >
                    {(t * 100).toFixed(1)}%
                  </text>
                </g>
              ))}
              {s.rows.map((r, i) =>
                r[0].endsWith('-01') ? (
                  <text
                    key={r[0]}
                    className="mean-txt-t"
                    x={x(i)}
                    y={H - 2}
                    textAnchor="middle"
                  >
                    {r[0].slice(0, 4)}
                  </text>
                ) : null,
              )}
              <path
                d={`${line(pts(3))}L${x(s.rows.length - 1)},${y(0)}L${m},${y(0)}Z`}
                fill={color(2)}
                fillOpacity={0.5}
              />
              <path
                d={line(pts(4))}
                stroke={color(0)}
                strokeWidth={2}
                fill="none"
              />
            </Svg>
            <Legend
              items={[
                ['share', color(2)],
                ['3-month mean', color(0)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-reference-arcs',
    domain: d,
    sources: ['ai-act/articles.json'],
    size: 'wide',
    render: () => <ReferenceArcs />,
  },
  {
    id: 'txt-act-signal-line',
    domain: d,
    sources: ['ai-act/signals.json'],
    size: 'wide',
    render: () => <SignalLine />,
  },
]
