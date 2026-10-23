/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Bars,
  every,
  int,
  pc,
  PARTIES,
  sum,
  uniq,
  XTicks,
  YGrid,
} from './pol-kit'

type Studies = {
  per_year: { year: number; kind: string; published: number; cited: number }[]
}
type News = {
  party_counts_30d: Record<string, number>
  topics: { key: string; name_en: string }[]
  items: { topics: string[] }[]
}
function StudyBars() {
  const data = useData<Studies>('parliament/studies.json')
  const [m, setM] = useState<'published' | 'cited'>('published')
  return (
    <Frame data={data}>
      {(d) => {
        const ys = uniq(d.per_year.map((r) => r.year)).sort()
        const kinds = uniq(d.per_year.map((r) => r.kind)).sort()
        const tot = ys.map((y) =>
          sum(d.per_year.filter((r) => r.year === y).map((r) => r[m])),
        )
        const ticks = niceTicks(Math.max(...tot))
        const y = linearScale([0, ticks.at(-1)!], [196, 8])
        const w = 264 / ys.length
        return (
          <>
            <Slicer
              label="Measure"
              cycles={false}
              options={['published', 'cited'] as const}
              value={m}
              onChange={setM}
            />
            <svg
              viewBox="0 0 300 214"
              role="img"
              aria-label={`Studies ${m} per year by kind`}
            >
              <YGrid ticks={ticks} x0={30} x1={296} y={y} />
              {ys.map((yr, i) => {
                let acc = 0
                return kinds.map((k, ki) => {
                  const v =
                    d.per_year.find((r) => r.year === yr && r.kind === k)?.[
                      m
                    ] ?? 0
                  const y0 = acc
                  acc += v
                  return (
                    <rect
                      key={yr + k}
                      x={32 + i * w}
                      y={y(acc)}
                      width={w - 1.5}
                      height={y(y0) - y(acc)}
                      fill={color(ki + 1)}
                    >
                      <title>{`${k} ${yr}: ${v}`}</title>
                    </rect>
                  )
                })
              })}
              <XTicks
                y={210}
                ticks={every(ys, 5).map((yr) => ({
                  x: 32 + ys.indexOf(yr) * w + w / 2,
                  label: yr,
                }))}
              />
            </svg>
            <div className="mean-legend">
              {kinds.map((k, i) => (
                <span key={k}>
                  <i style={{ background: color(i + 1) }} />
                  {k}
                </span>
              ))}
            </div>
          </>
        )
      }}
    </Frame>
  )
}

function NewsRadial() {
  return (
    <Frame data={useData<News>('parliament/news.json')}>
      {(d) => {
        const ps = PARTIES.filter((p) => d.party_counts_30d[p] !== undefined)
        const max = Math.max(...ps.map((p) => d.party_counts_30d[p]), 1)
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="News mentions per party, last 30 days, radial lollipop"
          >
            {ps.map((p, i) => {
              const a = (i / ps.length) * Math.PI * 2
              const r = 34 + (d.party_counts_30d[p] / max) * 96
              const [x, y] = [150 + r * Math.sin(a), 150 - r * Math.cos(a)]
              return (
                <g key={p}>
                  <line
                    x1={150 + 30 * Math.sin(a)}
                    y1={150 - 30 * Math.cos(a)}
                    x2={x}
                    y2={y}
                    stroke={pc(p)}
                    strokeWidth={3}
                  />
                  <circle cx={x} cy={y} r={9} fill={pc(p)} />
                  <text
                    x={150 + (r + 18) * Math.sin(a)}
                    y={153 - (r + 18) * Math.cos(a)}
                    textAnchor="middle"
                    className="mean-pol-t"
                  >
                    {p} {d.party_counts_30d[p]}
                  </text>
                </g>
              )
            })}
          </svg>
        )
      }}
    </Frame>
  )
}

/** Items per topic, most first; an item can carry several topics. */
const topicCounts = (d: News) => {
  const names = new Map(d.topics.map((t) => [t.key, t.name_en]))
  const counts = new Map<string, number>()
  for (const t of d.items.flatMap((i) => i.topics))
    counts.set(t, (counts.get(t) ?? 0) + 1)
  // A topic without a name is left out, so a key never shows.
  return [...counts]
    .filter(([k]) => names.has(k))
    .map(([k, n]) => ({ key: k, name: names.get(k)!, n }))
    .sort((a, b) => b.n - a.n)
}

function NewsTopics() {
  return (
    <Frame data={useData<News>('parliament/news.json')}>
      {(d) => (
        <Bars
          label="News items per topic, top 10"
          format={int}
          rows={topicCounts(d)
            .slice(0, 10)
            .map((t, i) => ({
              key: t.key,
              label: <span title={t.name}>{t.name}</span>,
              value: t.n,
              color: focal(i === 0),
            }))}
        />
      )}
    </Frame>
  )
}

function newsTitle(d: News) {
  const [top] = topicCounts(d)
  return top
    ? `${top.name} is the most common news topic: ${top.n} of ${d.items.length} items`
    : 'News items per topic'
}

export const posts: Post[] = [
  {
    id: 'pol-news-radial',
    domain: 'politics',
    sources: ['parliament/news.json'],
    render: () => <NewsRadial />,
  },
  {
    id: 'pol-study-bars',
    domain: 'politics',
    sources: ['parliament/studies.json'],
    render: () => <StudyBars />,
  },
  {
    id: 'pol-news-topics',
    domain: 'politics',
    sources: ['parliament/news.json'],
    title: newsTitle,
    note: 'News items per topic, top 10; an item can have several topics. Sources: SVT, Ekot, Government Offices.',
    render: () => <NewsTopics />,
  },
]
