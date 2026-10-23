/** Embedding maps and the philosophy atlas: scatters, bubbles, box plots, slopes and stacks. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Legend, Svg, fmt, palette, ticksIn, uniq } from './txt-kit'

type Work = {
  document_id: string
  author: string
  year: number
  tradition: string
  passages: number
  words: number
}
type PhilSummary = {
  works: Work[]
  run: { evaluation: Record<string, Record<string, number>> }
}
type Tension = {
  tension_id: string
  document_id: string
  mean_position: number
  q1: number
  median: number
  q3: number
}
const extent = (xs: number[]) =>
  [Math.min(...xs), Math.max(...xs)] as [number, number]

function WorksBubble() {
  const data = useData<PhilSummary>('philosophy/summary.json')
  return (
    <Frame data={data}>
      {({ works }) => {
        const trad = palette(uniq(works.map((w) => w.tradition)))
        const [W, H, m] = [400, 400, 36]
        const yt = niceTicks(Math.max(...works.map((w) => w.words)))
        const x = linearScale(extent(works.map((w) => w.year)), [
          m + 20,
          W - 24,
        ])
        const y = linearScale([0, yt.at(-1)!], [H - 16, 8])
        const r = (n: number) => 4 + Math.sqrt(n) * 0.5
        const xt = ticksIn(extent(works.map((w) => w.year)), 5)
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Philosophy works by year, length and passages"
            >
              {yt.map((t) => (
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
                    {fmt(t)}
                  </text>
                </g>
              ))}
              {xt.map((t) => (
                <text
                  key={t}
                  className="mean-txt-t"
                  x={x(t)}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {t}
                </text>
              ))}
              {works.map((w) => (
                <circle
                  key={w.document_id}
                  cx={x(w.year)}
                  cy={y(w.words)}
                  r={r(w.passages)}
                  fill={trad.get(w.tradition)}
                  fillOpacity={0.75}
                  stroke="var(--paper)"
                >
                  <title>{`${w.author} · ${w.year} · ${fmt(w.words)} words · ${w.passages} passages`}</title>
                </circle>
              ))}
            </Svg>
            <Legend items={[...trad]} />
          </>
        )
      }}
    </Frame>
  )
}
function TensionBoxes() {
  const data = useData<{ distribution: Tension[] }>('philosophy/tensions.json')
  const [tid, setTid] = useState('freedom_control')
  return (
    <Frame data={data}>
      {({ distribution }) => {
        const ids = uniq(distribution.map((t) => t.tension_id))
        const rows = distribution
          .filter((t) => t.tension_id === tid)
          .sort((a, b) => a.median - b.median)
        const [W, H, m] = [300, 600, 112]
        const dom = extent(distribution.flatMap((t) => [t.q1, t.q3]))
        const x = linearScale(dom, [m, W - 8])
        const rh = (H - 14) / Math.max(rows.length, 1)
        return (
          <>
            <Slicer
              label="Tension"
              cycles={false}
              options={ids}
              value={ids.includes(tid) ? tid : ids[0]}
              onChange={setTid}
            />
            <Svg
              w={W}
              h={H}
              label="Where each work sits between the two poles of a tension"
            >
              {dom[0] < 0 && (
                <line
                  x1={x(0)}
                  x2={x(0)}
                  y1={0}
                  y2={H - 14}
                  stroke="var(--line-strong)"
                />
              )}
              {rows.map((t, i) => {
                const cy = (i + 0.5) * rh
                return (
                  <g key={t.document_id}>
                    <text
                      className="mean-txt-t"
                      x={m - 4}
                      y={cy + 3}
                      textAnchor="end"
                    >
                      {t.document_id}
                    </text>
                    <rect
                      x={x(t.q1)}
                      y={cy - rh * 0.3}
                      width={x(t.q3) - x(t.q1)}
                      height={rh * 0.6}
                      rx={3}
                      fill={color(i)}
                      fillOpacity={0.8}
                    />
                    <line
                      x1={x(t.median)}
                      x2={x(t.median)}
                      y1={cy - rh * 0.35}
                      y2={cy + rh * 0.35}
                      stroke="var(--ink)"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={x(t.mean_position)}
                      cy={cy}
                      r={2.5}
                      fill="var(--paper)"
                      stroke="var(--ink)"
                    >
                      <title>{`${t.document_id}: ${t.median.toFixed(3)}`}</title>
                    </circle>
                  </g>
                )
              })}
              {ticksIn(dom).map((t) => (
                <text
                  key={t}
                  className="mean-txt-t"
                  x={x(t)}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {t}
                </text>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

const d = 'ml'
export const posts: Post[] = [
  {
    id: 'txt-ml-works-bubble',
    domain: d,
    sources: ['philosophy/summary.json'],
    render: () => <WorksBubble />,
  },
  {
    id: 'txt-ml-tension-boxes',
    domain: d,
    sources: ['philosophy/tensions.json'],
    size: 'tall',
    render: () => <TensionBoxes />,
  },
]
