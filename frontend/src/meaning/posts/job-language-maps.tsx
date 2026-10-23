/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { useState } from 'react'
import { color, focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Bars,
  Big,
  compact,
  D,
  fieldName,
  fmt,
  linePath,
  pct,
  sum,
  Svg,
  XLabels,
} from './job-kit'

/** [year, texts, texts_matching, matches, words, share, share_std, per_1000, per_1000_std];
 * this file reads only the counts, which are never null. */
type Row = number[]
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
                  cycles
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
  const [cat, setCat] = useState('passion')
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => {
            const year = fullYears(d).at(-1)
            const c = t.categories.find((k) => k.id === cat) ?? t.categories[0]
            const rows = d.rows
              .filter((r) => r[1] === c?.id && r[2] === year && r[3] > 0)
              .map((r) => ({ field: r[0], s: r[4] / r[3] }))
              .sort((a, b) => b.s - a.s)
            return (
              <>
                <Slicer
                  label="Kind of wording"
                  options={t.categories.map((k) => k.id)}
                  format={(id) =>
                    t.categories.find((k) => k.id === id)?.label_en ?? id
                  }
                  value={c?.id ?? cat}
                  onChange={setCat}
                />
                <p className="mean-job-cap">
                  {c?.label_en}, {year}
                </p>
                <Bars
                  label={`Share of each field's ad texts using ${c?.label_en ?? cat}, ${year}`}
                  format={(v) => pct(v)}
                  rows={rows.map((r, j) => ({
                    key: r.field,
                    label: fieldName(r.field),
                    value: r.s,
                    color: focal(j === 0),
                  }))}
                />
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
        const W = 300,
          H = 220,
          L = 34,
          R = 216,
          B = 200
        const y = linearScale([0, ticks.at(-1)!], [B, 8])
        const bw = (R - L) / a.length
        const last = a.at(-1)
        return (
          <Svg w={W} h={H} label="Ads and distinct ad texts per archive">
            <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
            {a.map((r, i) => (
              <g key={r.archive}>
                <title>{`${r.archive}: ${fmt(r.ads)} ads, ${fmt(r.distinct_texts)} texts`}</title>
                <rect
                  x={L + i * bw + 0.5}
                  y={y(r.ads)}
                  width={bw - 1}
                  height={B - y(r.ads)}
                  fill={OTHER}
                />
                <rect
                  x={L + i * bw + bw * 0.2}
                  y={y(r.distinct_texts)}
                  width={bw * 0.6}
                  height={B - y(r.distinct_texts)}
                  fill={focal(true)}
                />
              </g>
            ))}
            {last && (
              <EndLabels
                x={R + 6}
                top={8}
                bottom={B}
                items={[
                  { y: y(last.ads), label: 'ads', color: 'var(--mean-muted)' },
                  {
                    y: y(last.distinct_texts),
                    label: 'distinct texts',
                    color: focal(true),
                  },
                ]}
              />
            )}
            <XLabels
              y={H - 4}
              items={a
                .filter((_, i) => i % 5 === 0)
                .map((r) => ({
                  x: L + a.indexOf(r) * bw + bw / 2,
                  label: r.archive.slice(0, 4),
                }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function Words() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => {
        const rows = t.categories[0]?.rows ?? []
        return (
          <Big
            value={compact(sum(rows.map((r) => r[4])))}
            unit={`words in ${compact(sum(rows.map((r) => r[1])))} distinct ad texts, ${rows[0]?.[0]}–${rows.at(-1)?.[0]}`}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-lang-words',
    domain: D,
    sources: ['sweden/language/trends.json'],
    title: 'How much job-ad text the language posts read',
    note: 'Headline and description of each distinct ad text; Arbetsförmedlingen archives',
    render: () => <Words />,
  },
  {
    id: 'job-lang-parallel',
    domain: D,
    sources: ['sweden/language/regions.json', 'sweden/language/trends.json'],
    size: 'wide',
    render: () => <Parallel />,
  },
  {
    id: 'job-lang-field-matrix',
    domain: D,
    sources: ['sweden/language/fields.json', 'sweden/language/trends.json'],
    title: 'Which fields use each kind of wording most',
    note: "Share of a field's distinct ad texts using the wording, latest full year; fields with under 30 texts left out",
    render: () => <FieldMatrix />,
  },
  {
    id: 'job-lang-coverage',
    domain: D,
    sources: ['sweden/language/coverage.json'],
    title: (c: Coverage) =>
      `${compact(sum(c.archives.map((a) => a.distinct_texts)))} distinct ad texts in ${c.archives.length} archives`,
    note: 'Ads and distinct texts per yearly or quarterly archive; a text repeated in several ads counts once',
    render: () => <CoverageBars />,
  },
]
