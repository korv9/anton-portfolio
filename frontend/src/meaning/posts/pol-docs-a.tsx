/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  every,
  pc,
  PARTIES,
  squarify,
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

/** Topic keys are the Riksdag issue keys; government formation is the one news-only topic. */
const TOPIC_NAMES: Record<string, string> = {
  regeringsbildning: 'Government formation',
}

function NewsTopics() {
  const issues = useData<{
    issues: { issue_key: string; issue_name_en: string }[]
  }>('parliament/issues.json')
  const names =
    issues && !(issues instanceof Error)
      ? Object.fromEntries(
          issues.issues.map((i) => [i.issue_key, i.issue_name_en]),
        )
      : {}
  // Tiles stay unlabelled until the names are known, so a key never shows.
  const label = (k: string) => names[k] ?? TOPIC_NAMES[k]
  return (
    <Frame data={useData<News>('parliament/news.json')}>
      {(d) => {
        const counts = [
          ...d.items
            .flatMap((i) => i.topics)
            .reduce(
              (m, t) => m.set(t, (m.get(t) ?? 0) + 1),
              new Map<string, number>(),
            ),
        ]
        const rects = squarify(counts, ([, n]) => n, {
          x: 0,
          y: 0,
          w: 300,
          h: 300,
        })
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="News items per topic, treemap"
          >
            {rects.map((r, i) => (
              <g key={r.item[0]}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={focal(i === 0)}
                  stroke="var(--paper)"
                  strokeWidth={2}
                />
                {r.w > 50 && r.h > 18 && label(r.item[0]) && (
                  <text
                    x={r.x + 5}
                    y={r.y + 13}
                    className="mean-pol-t"
                    style={{ fill: 'var(--ink)' }}
                  >
                    {label(r.item[0])} {r.item[1]}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'pol-news-radial', domain: 'politics', render: () => <NewsRadial /> },
  { id: 'pol-study-bars', domain: 'politics', render: () => <StudyBars /> },
  { id: 'pol-news-topics', domain: 'politics', render: () => <NewsTopics /> },
]
