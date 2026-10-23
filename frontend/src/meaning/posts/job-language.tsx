/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Bars,
  change,
  D,
  Legend,
  linePath,
  pct,
  Svg,
  XLabels,
  YTicks,
} from './job-kit'

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

/** Change in the standardised rate per 1,000 words from before a category's break year to after. */
const jump = (c: Category) => c.break.mean_after / c.break.mean_before - 1
const byJump = (t: Trends) =>
  [...t.categories].sort((a, b) => jump(b) - jump(a))

function Dumbbell() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => (
        <Bars
          label="Change in each category's rate per 1,000 words after its break year"
          format={change}
          rows={byJump(t).map((c, j) => ({
            key: c.id,
            label: short(c.label_en),
            value: jump(c),
            color: focal(j === 0),
            note: `from ${c.break.first_year_after}`,
          }))}
        />
      )}
    </Frame>
  )
}

function Multiples() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => {
        const W = 300,
          cellH = 500 / t.categories.length
        // The focal row is the category whose share grew most since the first year.
        const rise = (c: Category) => c.rows.at(-1)![5] - c.rows[0][5]
        const top = t.categories.reduce((a, c) => (rise(c) > rise(a) ? c : a))
        return (
          <Svg
            w={W}
            h={510}
            label="Small multiples of each category's share of ad texts"
          >
            {t.categories.map((c, k) => {
              const x = linearScale([c.rows[0][0], c.rows.at(-1)![0]], [4, 236])
              const y = linearScale(
                [0, 1],
                [k * cellH + cellH - 4, k * cellH + 4],
              )
              const pts = c.rows.map(
                (r) => [x(r[0]), y(r[5])] as [number, number],
              )
              return (
                <g key={c.id}>
                  <title>{c.label_en}</title>
                  <path
                    d={`${linePath(pts)}L236,${y(0)}L4,${y(0)}Z`}
                    fill={focal(c === top)}
                    opacity={c === top ? 1 : 0.55}
                  />
                  <text
                    className={c === top ? 'mean-job-on' : 'mean-job-v'}
                    x={8}
                    y={k * cellH + 15}
                    stroke="var(--paper)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {short(c.label_en)}
                  </text>
                  <text
                    className="mean-job-v"
                    x={W - 2}
                    y={k * cellH + cellH / 2 + 4}
                    textAnchor="end"
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
  {
    id: 'job-lang-lines',
    domain: D,
    sources: ['sweden/language/trends.json'],
    size: 'wide',
    render: () => <Lines />,
  },
  {
    id: 'job-lang-dumbbell',
    domain: D,
    sources: ['sweden/language/trends.json'],
    title: (t: Trends) => {
      const c = byJump(t)[0]
      return c
        ? `${short(c.label_en)} words rose most after their break year: ${change(jump(c))}`
        : 'Change in ad wording after each break year'
    },
    note: "Matches per 1,000 words, field mix held fixed; mean after against before each category's break year (an exploratory split), 2006 on",
    render: () => <Dumbbell />,
  },
  {
    id: 'job-lang-multiples',
    domain: D,
    sources: ['sweden/language/trends.json'],
    size: 'tall',
    title: 'Share of job-ad texts using each kind of wording, 2006 on',
    note: 'Each panel 0–100 %; the latest year on the right; Arbetsförmedlingen ads',
    render: () => <Multiples />,
  },
]
