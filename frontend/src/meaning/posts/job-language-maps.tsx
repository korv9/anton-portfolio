/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { useState } from 'react'
import { focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Bars,
  Big,
  compact,
  D,
  fieldName,
  fmt,
  maxOf,
  pct,
  sum,
  Svg,
  XLabels,
} from './job-kit'

/** [year, texts, texts_matching, matches, words, ...]; this file reads only the counts. */
type Row = number[]
type Category = { id: string; label_en: string; rows: Row[] }
type Trends = { categories: Category[] }
type Cells = { rows: [string, string, number, number, number][] }
type Coverage = {
  archives: { archive: string; ads: number; distinct_texts: number }[]
}

const TRENDS = 'sweden/language/trends.json'
const FIELDS = 'sweden/language/fields.json'
const COVERAGE = 'sweden/language/coverage.json'

/** The latest year read from a whole-year archive; quarterly archives cover part of a year. */
const fullYear = (c: Coverage) =>
  maxOf(
    c.archives.filter((a) => /^\d{4}$/.test(a.archive)).map((a) => +a.archive),
  )

function FieldMatrix() {
  const trends = useData<Trends>(TRENDS)
  const data = useData<Cells>(FIELDS)
  const cover = useData<Coverage>(COVERAGE)
  const [cat, setCat] = useState<string | null>(null)
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => (
            <Frame data={cover}>
              {(cv) => {
                const year = fullYear(cv)
                const c =
                  t.categories.find((k) => k.id === cat) ??
                  t.categories.find((k) => k.id === 'passion') ??
                  t.categories[0]
                if (!c || !year) return null
                const rows = d.rows
                  .filter((r) => r[1] === c.id && r[2] === year && r[3] > 0)
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
                      value={c.id}
                      onChange={setCat}
                    />
                    <p className="mean-cap">
                      {c.label_en}, {year}
                    </p>
                    <Bars
                      label={`Share of each field's ad texts using ${c.label_en}, ${year}`}
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
        const last = a.at(-1)
        if (!last) return null
        const ticks = niceTicks(
          maxOf(
            a.map((r) => r.ads),
            1,
          ),
        )
        const W = 300,
          H = 220,
          L = 34,
          R = 216,
          B = 200
        const y = linearScale([0, ticks.at(-1)!], [B, 8])
        const bw = (R - L) / a.length
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
        if (!rows.length) return null
        return (
          <Big
            value={compact(sum(rows.map((r) => r[4])))}
            unit={`words in ${compact(sum(rows.map((r) => r[1])))} ad texts, ${rows[0][0]}–${rows.at(-1)![0]}`}
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
    note: 'Headline and description of each ad text; a text repeated within an archive counts once, so the count is distinct texts per archive, summed',
    render: () => <Words />,
  },
  {
    id: 'job-lang-field-matrix',
    domain: D,
    sources: [
      'sweden/language/fields.json',
      'sweden/language/trends.json',
      'sweden/language/coverage.json',
    ],
    title: 'Which fields use each kind of wording most',
    note: "Share of a field's distinct ad texts using the wording, latest whole-year archive; fields with under 30 texts left out",
    render: () => <FieldMatrix />,
  },
  {
    id: 'job-lang-coverage',
    domain: D,
    sources: ['sweden/language/coverage.json'],
    title: (c: Coverage) =>
      c.archives.length
        ? `${compact(sum(c.archives.map((a) => a.distinct_texts)))} ad texts in ${c.archives.length} archives`
        : 'Ads and ad texts per archive',
    note: 'Ads and distinct texts per yearly or quarterly archive; a text repeated within an archive counts once, and the total sums the archives',
    render: () => <CoverageBars />,
  },
]
