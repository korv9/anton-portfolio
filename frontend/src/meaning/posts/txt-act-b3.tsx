/** AI Act duties, actors, cross-references and outside signals: heatmap, donut, flows, arcs, lines. */
import { useState } from 'react'
import { Frame, PALETTE, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Bars, Legend, Svg, line } from './txt-kit'

type Article = {
  article_number: string
  title_en: string
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

/** How many other articles cite each article, most first. */
function cited(rows: Article[]) {
  const n = new Map<string, number>()
  for (const a of rows)
    for (const r of new Set(a.refers_to))
      if (r !== a.article_number) n.set(r, (n.get(r) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1])
}
/** The source carries a stray quote on some titles. */
const clean = (t: string) => t.replace(/['\u2019]+$/, '')

function ReferenceArcs() {
  const data = useData<Article[]>('ai-act/articles.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const title = new Map(rows.map((a) => [a.article_number, a.title_en]))
        const ranked = cited(rows)
        return (
          <Bars
            label="AI Act articles cited most often by other articles"
            format={String}
            long
            focus={null}
            rows={ranked.map(([k, n]) => ({
              key: k,
              label: `${k} ${clean(title.get(k) ?? '')}`,
              value: n,
              color: n === ranked[0][1] ? PALETTE[0] : undefined,
            }))}
          />
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
    title: (rows: Article[]) => {
      const ranked = cited(rows)
      const top = ranked.filter(([, n]) => n === ranked[0][1]).map(([k]) => k)
      return top.length === 1
        ? `Article ${top[0]} is cited by ${ranked[0][1]} other articles, the most`
        : `Articles ${top.slice(0, -1).join(', ')} and ${top.at(-1)} are each cited by ${ranked[0][1]} other articles`
    },
    note: 'Other AI Act articles that refer to each article; the top ten show until opened',
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
