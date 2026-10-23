/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Bars, Kpis, Legend, Svg, fmt, squarify, sum, uniq } from './txt-kit'

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
const TREE_METRICS = ['characters', 'articles', 'references'] as const
const d = 'ai-act'

/** Chapter headings of Regulation (EU) 2024/1689, shortened where long. */
const CHAPTERS: Record<string, string> = {
  I: 'General provisions',
  II: 'Prohibited practices',
  III: 'High-risk AI systems',
  IV: 'Transparency obligations',
  V: 'General-purpose AI models',
  VI: 'Support for innovation',
  VII: 'Governance',
  VIII: 'EU database',
  IX: 'Monitoring and market surveillance',
  X: 'Codes of conduct',
  XI: 'Delegated powers',
  XII: 'Penalties',
  XIII: 'Final provisions',
}
type Summary = {
  counts: Record<string, number>
  current_version: { published_at: string }
  amended_by: { published_at: string }[]
}
/** Characters per chapter, largest first. */
const byChapter = (rows: Article[]) =>
  [
    ...rows.reduce(
      (m, a) => m.set(a.chapter, (m.get(a.chapter) ?? 0) + a.char_count),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1])

function ArticleBars() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => (
        <Bars
          label="Characters per chapter of the AI Act, largest first"
          format={fmt}
          long
          rows={byChapter(rows).map(([c, n]) => ({
            key: c,
            label: `${c} ${CHAPTERS[c] ?? ''}`,
            value: n,
          }))}
        />
      )}
    </Frame>
  )
}
function Counts() {
  const data = useData<Summary>('ai-act/summary.json')
  return (
    <Frame data={data}>
      {({ counts: c }) => (
        <Kpis
          items={[
            [fmt(c.articles), 'articles'],
            [fmt(c.articles_changed), 'new or amended since 2024'],
            [fmt(c.obligations), 'obligations on named actors'],
            [fmt(c.actors), 'defined actors'],
          ]}
        />
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
              cycles={false}
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
    sources: ['ai-act/articles.json'],
    size: 'wide',
    title: (rows: Article[]) => {
      const [[c, n]] = byChapter(rows)
      const all = sum(rows.map((a) => a.char_count))
      return `Chapter ${c} holds ${Math.round((n / all) * 100)}% of the Act's text, the most of any chapter`
    },
    note: 'Characters per chapter of Regulation (EU) 2024/1689, consolidated text',
    render: () => <ArticleBars />,
  },
  {
    id: 'txt-act-counts',
    domain: d,
    sources: ['ai-act/summary.json'],
    title: (s: Summary) =>
      `${s.counts.articles_changed} of ${s.counts.articles} articles are new or amended since 2024`,
    note: 'Regulation (EU) 2024/1689; counts from EUR-Lex, consolidated text',
    render: () => <Counts />,
  },
  {
    id: 'txt-act-chapter-treemap',
    domain: d,
    sources: ['ai-act/articles.json'],
    size: 'tall',
    render: () => <ChapterTreemap />,
  },
]
