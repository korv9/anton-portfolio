/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { D, Legend, linePath, pct, Svg, XLabels, YTicks } from './job-kit'

/** [year, texts, texts_matching, matches, words, share, share_std, per_1000, per_1000_std] */
type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number,
  number | null,
]
type Category = {
  id: string
  label_en: string
  rows: Row[]
  break: { first_year_after: number; mean_before: number; mean_after: number }
}
type Trends = { categories: Category[] }
const TRENDS = 'sweden/language/trends.json'
const rate = (r: Row) => r[8] ?? r[7]
const short = (s: string) => s.split(' and ')[0]

function Lines() {
  const data = useData<Trends>(TRENDS)
  const [metric, setMetric] = useState<'per 1,000 words' | 'share'>(
    'per 1,000 words',
  )
  return (
    <Frame data={data}>
      {(t) => {
        const v = (r: Row) => (metric === 'share' ? (r[6] ?? r[5]) : rate(r))
        const years = t.categories[0]?.rows.map((r) => r[0]) ?? []
        const ticks = niceTicks(
          Math.max(...t.categories.flatMap((c) => c.rows.map(v))),
        )
        const W = 800,
          H = 340,
          L = 40,
          B = 310
        const x = linearScale([years[0], years.at(-1)!], [L, W - 10])
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        return (
          <>
            <Slicer
              label="Metric"
              cycles={false}
              options={['per 1,000 words', 'share'] as const}
              value={metric}
              onChange={setMetric}
            />
            <Svg w={W} h={H} label="Ad language categories per year">
              <YTicks
                ticks={ticks}
                y={y}
                x0={L}
                x1={W - 10}
                f={(n) => (metric === 'share' ? pct(n) : String(n))}
              />
              {t.categories.map((c, k) => (
                <path
                  key={c.id}
                  d={linePath(c.rows.map((r) => [x(r[0]), y(v(r))]))}
                  fill="none"
                  stroke={color(k)}
                  strokeWidth={k ? 2 : 3.5}
                >
                  <title>{c.label_en}</title>
                </path>
              ))}
              <XLabels
                y={H - 8}
                items={years
                  .filter((yr) => yr % 4 === 2)
                  .map((yr) => ({ x: x(yr), label: String(yr) }))}
              />
            </Svg>
            <Legend
              items={t.categories.map((c, k) => [short(c.label_en), color(k)])}
            />
          </>
        )
      }}
    </Frame>
  )
}

function Dumbbell() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => {
        const cs = [...t.categories].sort(
          (a, b) => b.break.mean_after - a.break.mean_after,
        )
        const max = Math.max(
          ...cs.flatMap((c) => [c.break.mean_before, c.break.mean_after]),
        )
        const x = linearScale([0, Math.sqrt(max)], [110, 385])
        const rowH = 360 / cs.length
        return (
          <>
            <Svg
              w={400}
              h={390}
              label="Dumbbell of each category's rate before and after its break year"
            >
              {cs.map((c, j) => {
                const cy = j * rowH + rowH / 2,
                  b = c.break
                return (
                  <g key={c.id}>
                    <title>{`${c.label_en}: ${b.mean_before.toFixed(2)} → ${b.mean_after.toFixed(2)} from ${b.first_year_after}`}</title>
                    <text x={104} y={cy + 4} textAnchor="end" fontSize={10}>
                      {short(c.label_en)}
                    </text>
                    <line
                      x1={x(Math.sqrt(b.mean_before))}
                      x2={x(Math.sqrt(b.mean_after))}
                      y1={cy}
                      y2={cy}
                      stroke="var(--line-strong)"
                      strokeWidth={4}
                    />
                    <circle
                      cx={x(Math.sqrt(b.mean_before))}
                      cy={cy}
                      r={7}
                      fill={color(2)}
                    />
                    <circle
                      cx={x(Math.sqrt(b.mean_after))}
                      cy={cy}
                      r={7}
                      fill={color(0)}
                    />
                  </g>
                )
              })}
              <XLabels
                y={384}
                items={[1, 2, 4, Math.round(max)].map((v) => ({
                  x: x(Math.sqrt(v)),
                  label: String(v),
                }))}
              />
            </Svg>
            <Legend
              items={[
                ['before', color(2)],
                ['after', color(0)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

function Multiples() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => {
        const cellH = 780 / t.categories.length
        // The focal row is the category whose share grew most since the first year.
        const rise = (c: Category) => c.rows.at(-1)![5] - c.rows[0][5]
        const top = t.categories.reduce((a, c) => (rise(c) > rise(a) ? c : a))
        return (
          <Svg
            w={400}
            h={790}
            label="Small multiples of each category's share of ad texts"
          >
            {t.categories.map((c, k) => {
              const x = linearScale(
                [c.rows[0][0], c.rows.at(-1)![0]],
                [10, 300],
              )
              const y = linearScale(
                [0, 1],
                [k * cellH + cellH - 6, k * cellH + 6],
              )
              const pts = c.rows.map(
                (r) => [x(r[0]), y(r[5])] as [number, number],
              )
              return (
                <g key={c.id}>
                  <title>{c.label_en}</title>
                  <path
                    d={`${linePath(pts)}L300,${y(0)}L10,${y(0)}Z`}
                    fill={focal(c === top)}
                    opacity={c === top ? 1 : 0.55}
                  />
                  <text
                    x={14}
                    y={k * cellH + 20}
                    fontSize={13}
                    fontWeight={c === top ? 700 : 500}
                    stroke="var(--paper)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {short(c.label_en)}
                  </text>
                  <text
                    x={392}
                    y={k * cellH + cellH / 2 + 8}
                    textAnchor="end"
                    fontSize={20}
                    fontWeight={700}
                  >
                    {pct(c.rows.at(-1)![5])}
                  </text>
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'job-lang-lines', domain: D, size: 'wide', render: () => <Lines /> },
  { id: 'job-lang-dumbbell', domain: D, render: () => <Dumbbell /> },
  {
    id: 'job-lang-multiples',
    domain: D,
    size: 'tall',
    render: () => <Multiples />,
  },
]
