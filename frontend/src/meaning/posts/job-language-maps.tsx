/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Big,
  compact,
  D,
  fieldName,
  fmt,
  Legend,
  linePath,
  pct,
  sum,
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
type Cells = { rows: [string, string, number, number, number][] }
type Coverage = {
  archives: { archive: string; ads: number; distinct_texts: number }[]
}

const TRENDS = 'sweden/language/trends.json'
const REGIONS = 'sweden/language/regions.json'
const FIELDS = 'sweden/language/fields.json'
const COVERAGE = 'sweden/language/coverage.json'

/** Years in the file, less the running calendar year: its ads cover only part of it. */
const fullYears = (d: Cells) =>
  [...new Set(d.rows.map((r) => r[2]))]
    .filter((y) => y < new Date().getFullYear())
    .sort()

function Parallel() {
  const trends = useData<Trends>(TRENDS)
  const data = useData<Cells>(REGIONS)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => {
            const cats = t.categories.map((c) => c.id)
            const years = fullYears(d)
            const regions = [...new Set(d.rows.map((r) => r[0]))]
            const share = (reg: string, cat: string) => {
              const r = d.rows.find(
                (x) => x[0] === reg && x[1] === cat && x[2] === year,
              )
              return r ? r[4] / r[3] : null
            }
            const W = 800,
              H = 360
            const x = (i: number) => 30 + (i / (cats.length - 1)) * (W - 60)
            const ext = cats.map((c) => {
              const v = regions
                .map((r) => share(r, c))
                .filter((n): n is number => n !== null)
              return [Math.min(...v), Math.max(...v)] as [number, number]
            })
            return (
              <>
                <Slicer
                  label="Year"
                  options={years}
                  value={year}
                  onChange={setYear}
                />
                <Svg
                  w={W}
                  h={H}
                  label="Parallel coordinates of counties across language categories"
                >
                  {cats.map((c, i) => (
                    <line
                      key={c}
                      x1={x(i)}
                      x2={x(i)}
                      y1={10}
                      y2={H - 30}
                      stroke="var(--line-strong)"
                    />
                  ))}
                  {regions.map((reg, k) => {
                    const pts = cats.flatMap((c, i) => {
                      const v = share(reg, c)
                      return v === null
                        ? []
                        : [
                            [x(i), linearScale(ext[i], [H - 30, 10])(v)] as [
                              number,
                              number,
                            ],
                          ]
                    })
                    return (
                      <path
                        key={reg}
                        d={linePath(pts)}
                        fill="none"
                        stroke={color(k)}
                        strokeWidth={1.6}
                        opacity={0.75}
                        className="mean-job-hover"
                      >
                        <title>{reg}</title>
                      </path>
                    )
                  })}
                  <XLabels
                    y={H - 10}
                    items={t.categories.map((c, i) => ({
                      x: x(i),
                      label: c.id,
                    }))}
                  />
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function FieldMatrix() {
  const trends = useData<Trends>(TRENDS)
  const data = useData<Cells>(FIELDS)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => {
            const cats = t.categories.map((c) => c.id)
            const fields = [...new Set(d.rows.map((r) => r[0]))].sort()
            const years = fullYears(d).slice(-6)
            const L = 150,
              cw = (400 - L) / cats.length,
              rowH = 370 / fields.length
            return (
              <>
                <Slicer
                  label="Year"
                  options={years}
                  value={year}
                  onChange={setYear}
                />
                <Svg
                  w={400}
                  h={400}
                  label="Bubble matrix of category share by occupation field"
                >
                  {fields.map((f, j) => (
                    <g key={f}>
                      <text
                        x={L - 4}
                        y={j * rowH + rowH / 2 + 3}
                        textAnchor="end"
                        fontSize={8}
                      >
                        {fieldName(f)}
                      </text>
                      {cats.map((c, i) => {
                        const r = d.rows.find(
                          (x) => x[0] === f && x[1] === c && x[2] === year,
                        )
                        const s = r ? r[4] / r[3] : 0
                        return (
                          <circle
                            key={c}
                            cx={L + i * cw + cw / 2}
                            cy={j * rowH + rowH / 2}
                            r={Math.sqrt(s) * Math.min(cw, rowH) * 0.55}
                            fill={color(i)}
                          >
                            <title>{`${fieldName(f)}, ${c}: ${pct(s, 1)}`}</title>
                          </circle>
                        )
                      })}
                    </g>
                  ))}
                </Svg>
                <Legend items={t.categories.map((c, i) => [c.id, color(i)])} />
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

function CoverageBars() {
  const data = useData<Coverage>(COVERAGE)
  return (
    <Frame data={data}>
      {(c) => {
        const a = c.archives
        const ticks = niceTicks(Math.max(...a.map((r) => r.ads)))
        const y = linearScale([0, ticks.at(-1)!], [340, 10])
        const bw = 360 / a.length
        return (
          <>
            <Svg w={400} h={370} label="Ads and distinct ad texts per archive">
              <YTicks ticks={ticks} y={y} x0={38} x1={400} />
              {a.map((r, i) => (
                <g key={r.archive}>
                  <title>{`${r.archive}: ${fmt(r.ads)} ads, ${fmt(r.distinct_texts)} texts`}</title>
                  <rect
                    x={40 + i * bw}
                    y={y(r.ads)}
                    width={bw - 1}
                    height={340 - y(r.ads)}
                    fill={color(3)}
                  />
                  <rect
                    x={40 + i * bw + bw * 0.25}
                    y={y(r.distinct_texts)}
                    width={bw * 0.5}
                    height={340 - y(r.distinct_texts)}
                    fill={color(0)}
                  />
                </g>
              ))}
              <XLabels
                y={360}
                items={a
                  .filter((_, i) => i % 5 === 0)
                  .map((r) => ({
                    x: 40 + a.indexOf(r) * bw + bw / 2,
                    label: r.archive.slice(0, 4),
                  }))}
              />
            </Svg>
            <Legend
              items={[
                ['ads', color(3)],
                ['distinct texts', color(0)],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

function Words() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => (
        <Big
          value={compact(sum(t.categories[0]?.rows.map((r) => r[4]) ?? []))}
          unit="words"
          tone={4}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'job-lang-words', domain: D, render: () => <Words /> },
  {
    id: 'job-lang-parallel',
    domain: D,
    size: 'wide',
    render: () => <Parallel />,
  },
  { id: 'job-lang-field-matrix', domain: D, render: () => <FieldMatrix /> },
  { id: 'job-lang-coverage', domain: D, render: () => <CoverageBars /> },
]
