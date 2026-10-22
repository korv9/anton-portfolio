/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Legend, Svg, fmt, palette, squarify, sum, uniq } from './txt-kit'

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
const ARTICLES = 'ai-act/articles.json'
const sorted = (rows: Article[]) =>
  [...rows].sort((a, b) => a.article_sort - b.article_sort)
function YAxis({
  ticks,
  y,
  x0,
  x1,
}: {
  ticks: number[]
  y: (v: number) => number
  x0: number
  x1: number
}) {
  return ticks.map((t) => (
    <g key={t}>
      <line className="mean-txt-grid" x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
      <text className="mean-txt-t" x={x0 - 3} y={y(t) + 3} textAnchor="end">
        {fmt(t)}
      </text>
    </g>
  ))
}
const BAR_MODES = ['change', 'applies', 'chapter'] as const
const TREE_METRICS = ['characters', 'articles', 'references'] as const
const d = 'ai-act'

function ArticleBars() {
  const data = useData<Article[]>(ARTICLES)
  const [mode, setMode] = useState<(typeof BAR_MODES)[number]>('change')
  return (
    <Frame data={data}>
      {(rows) => {
        const arts = sorted(rows)
        const key = (a: Article) =>
          mode === 'change'
            ? a.change_type
            : mode === 'applies'
              ? (a.applies_from ?? 'none')
              : a.chapter
        const keys = uniq(arts.map(key))
        const cols = palette(mode === 'chapter' ? keys : keys.sort())
        const [W, H, m] = [600, 260, 30]
        const ticks = niceTicks(Math.max(...arts.map((a) => a.char_count)))
        const y = linearScale([0, ticks.at(-1)!], [H - 4, 6])
        const bw = (W - m) / arts.length
        return (
          <>
            <Slicer
              label="Colour by"
              options={BAR_MODES}
              value={mode}
              onChange={setMode}
            />
            <Svg w={W} h={H} label="Length of every AI Act article">
              <YAxis ticks={ticks} y={y} x0={m} x1={W} />
              {arts.map((a, i) => (
                <rect
                  key={a.article_number}
                  x={m + i * bw}
                  width={bw * 0.78}
                  y={y(a.char_count)}
                  height={H - 4 - y(a.char_count)}
                  fill={cols.get(key(a))}
                >
                  <title>{`${a.article_number}: ${fmt(a.char_count)}`}</title>
                </rect>
              ))}
            </Svg>
            <Legend items={[...cols]} />
          </>
        )
      }}
    </Frame>
  )
}
function Counts() {
  const data = useData<{ counts: Record<string, number> }>(
    'ai-act/summary.json',
  )
  return (
    <Frame data={data}>
      {(d) => (
        <div className="mean-txt-kpis">
          {Object.entries(d.counts).map(([k, v], i) => (
            <div
              key={k}
              style={{
                background: `color-mix(in srgb, ${color(i)} 45%, var(--paper))`,
              }}
            >
              {fmt(v)}
              <small>{k.replace(/_/g, ' ')}</small>
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}
function ChapterTreemap() {
  const data = useData<Article[]>(ARTICLES)
  const [metric, setMetric] =
    useState<(typeof TREE_METRICS)[number]>('characters')
  const v = (a: Article) =>
    metric === 'characters'
      ? a.char_count
      : metric === 'articles'
        ? 1
        : a.refers_to.length
  return (
    <Frame data={data}>
      {(rows) => {
        const arts = sorted(rows)
        const chapters = uniq(arts.map((a) => a.chapter)).map((c, i) => ({
          c,
          i,
          arts: arts.filter((a) => a.chapter === c),
        }))
        const cells = squarify(chapters, (g) => sum(g.arts.map(v)), {
          x: 0,
          y: 0,
          w: 400,
          h: 400,
        })
        return (
          <>
            <Slicer
              label="Size by"
              options={TREE_METRICS}
              value={metric}
              onChange={setMetric}
            />
            <Svg
              w={400}
              h={400}
              label="AI Act chapters as a treemap of articles"
            >
              {cells.map((g) =>
                squarify(g.t.arts, v, g).map((a) => (
                  <rect
                    key={a.t.article_number}
                    x={a.x}
                    y={a.y}
                    width={a.w}
                    height={a.h}
                    fill={color(g.t.i)}
                    stroke="var(--paper)"
                    strokeWidth={0.8}
                    className="mean-txt-hover"
                  >
                    <title>{`${g.t.c} · ${a.t.article_number}: ${fmt(v(a.t))}`}</title>
                  </rect>
                )),
              )}
              {cells.map((g) => (
                <rect
                  key={g.t.c}
                  x={g.x}
                  y={g.y}
                  width={g.w}
                  height={g.h}
                  fill="none"
                  stroke="var(--paper)"
                  strokeWidth={3}
                />
              ))}
            </Svg>
            <Legend items={chapters.map((g) => [g.c, color(g.i)])} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-article-bars',
    domain: d,
    size: 'wide',
    render: () => <ArticleBars />,
  },
  { id: 'txt-act-counts', domain: d, render: () => <Counts /> },
  {
    id: 'txt-act-chapter-treemap',
    domain: d,
    size: 'tall',
    render: () => <ChapterTreemap />,
  },
]
