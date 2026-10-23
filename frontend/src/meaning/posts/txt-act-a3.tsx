/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Kpi, Svg, fmt, sum, uniq } from './txt-kit'

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
type Dated = {
  date?: string
  change_date?: string
  kind?: string
  change_kind?: string
}
const ARTICLES = 'ai-act/articles.json'
const year = (d: string) => Date.parse(`${d.slice(0, 4)}-01-01`)
const SOURCES = ['milestones', 'changes'] as const
const d = 'ai-act'

function Timeline() {
  const [src, setSrc] = useState<(typeof SOURCES)[number]>('milestones')
  const data = useData<Dated[]>(
    src === 'milestones' ? 'ai-act/timeline.json' : 'ai-act/changes.json',
  )
  return (
    <>
      <Slicer label="Events" options={SOURCES} value={src} onChange={setSrc} />
      <Frame data={data}>
        {(rows) => {
          const items = rows
            .map((r) => ({
              d: (r.date ?? r.change_date)!,
              k: (r.kind ?? r.change_kind)!,
            }))
            .sort((a, b) => a.d.localeCompare(b.d))
          const kinds = uniq(items.map((i) => i.k))
          const [W, H, m] = [600, 260, 96]
          const yrs = uniq(items.map((i) => i.d.slice(0, 4)))
          const x = linearScale(
            [year(yrs[0]), year(String(+yrs.at(-1)! + 1))],
            [m, W - 6],
          )
          const rowH = (H - 16) / kinds.length
          const placed = new Map<string, number[]>()
          return (
            <Svg w={W} h={H} label="AI Act events by date and kind">
              {yrs.map((yr) => (
                <text
                  key={yr}
                  className="mean-txt-t"
                  x={x(year(yr))}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {yr}
                </text>
              ))}
              {kinds.map((k, r) => (
                <g key={k}>
                  <line
                    className="mean-txt-grid"
                    x1={m}
                    x2={W}
                    y1={(r + 0.5) * rowH}
                    y2={(r + 0.5) * rowH}
                  />
                  <text
                    className="mean-txt-t"
                    x={m - 4}
                    y={(r + 0.5) * rowH + 3}
                    textAnchor="end"
                  >
                    {k}
                  </text>
                </g>
              ))}
              {items.map((it, i) => {
                const px = x(Date.parse(it.d))
                const xs = placed.get(it.k) ?? []
                const lvl = xs.filter((p) => Math.abs(p - px) < 8).length
                placed.set(it.k, [...xs, px])
                const r = kinds.indexOf(it.k)
                return (
                  <circle
                    key={i}
                    cx={px}
                    cy={
                      (r + 0.5) * rowH -
                      (lvl % 2 ? -1 : 1) * Math.ceil(lvl / 2) * 6
                    }
                    r={4.5}
                    fill={color(r)}
                    stroke="var(--paper)"
                    strokeWidth={0.8}
                  >
                    <title>{`${it.d} · ${it.k}`}</title>
                  </circle>
                )
              })}
            </Svg>
          )
        }}
      </Frame>
    </>
  )
}
function References() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => (
        <Kpi
          value={fmt(sum(rows.map((a) => a.refers_to.length)))}
          unit="cross-references"
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-timeline',
    domain: d,
    sources: ['ai-act/changes.json', 'ai-act/timeline.json'],
    size: 'wide',
    render: () => <Timeline />,
  },
  {
    id: 'txt-act-references-kpi',
    domain: d,
    sources: ['ai-act/articles.json'],
    render: () => <References />,
  },
]
