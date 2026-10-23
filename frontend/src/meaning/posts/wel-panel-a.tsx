/** The county-year welfare panel: counties ranked by measure, and income against assistance. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import {
  CountyRank,
  Scatter,
  county,
  latestCounties,
  pearson,
  type CountyMetric,
  type CountyYear,
  type Dot,
} from './wel-charts'
import { fmt, num, pct } from './wel-kit'

/** The panel's measures, in plain words with their units. Turnout has its own post. */
const METRICS: Record<string, CountyMetric> = {
  assistance: {
    key: 'social_assistance_pct',
    name: 'residents receiving social assistance, %',
    format: (v) => pct(v),
  },
  income: {
    key: 'median_earned_income_sek',
    name: 'median earned income, SEK',
    format: (v) => fmt(v, 0),
  },
  'ill health': {
    key: 'ill_health_days',
    name: 'ill-health days per person aged 16–64',
    format: (v) => fmt(v, 1),
  },
  crime: {
    key: 'violent_crime_per_100k',
    name: 'reported violent crimes per 100,000 inhabitants',
    format: (v) => fmt(v, 0),
  },
  'sick leave': {
    key: 'ongoing_sick_leave_per_1000',
    name: 'ongoing sick-leave cases per 1,000 inhabitants',
    format: (v) => fmt(v, 1),
  },
  employment: {
    key: 'employment_rate_pct',
    name: 'employment rate, % of people aged 15–74',
    format: (v) => pct(v),
  },
}

const usePanel = () => useData<CountyYear[]>('welfare/panel-county-year.json')

function Ranks() {
  return (
    <Frame data={usePanel()}>
      {(rows) => <CountyRank rows={rows} metrics={METRICS} />}
    </Frame>
  )
}

const INCOME = 'median_earned_income_sek'
const HELP = 'social_assistance_pct'

/** County dots for a year with both measures. */
const dots = (rows: CountyYear[], year: number): Dot[] =>
  rows
    .filter(
      (r) => !r.is_country && r.year === year && num(r[INCOME]) && num(r[HELP]),
    )
    .map((r) => ({
      key: r.region_code,
      name: county(r.region_name),
      x: r[INCOME] as number,
      y: r[HELP] as number,
    }))

/** The years with both measures, latest last. */
const bothYears = (rows: CountyYear[]) =>
  [
    ...new Set(
      rows.filter((r) => num(r[INCOME]) && num(r[HELP])).map((r) => r.year),
    ),
  ].sort()

function IncomeScatter() {
  const data = usePanel()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(rows) => {
        const ys = bothYears(rows)
        const year = yr ?? ys[ys.length - 1]
        return (
          <>
            <Slicer
              label="Year"
              cycles
              options={ys.filter((v) => (ys.at(-1)! - v) % 4 === 0)}
              value={year}
              onChange={setYr}
            />
            <Scatter
              dots={dots(rows, year)}
              all={ys.flatMap((y) => dots(rows, y))}
              label="Median earned income against the share of residents receiving social assistance, one dot per county"
              xFormat={(v) => `${fmt(v / 1000, 0)}k`}
              yFormat={(v) => `${v}%`}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-county-multiples',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    size: 'tall',
    title: (rows: CountyYear[]) => {
      const { year, counties } = latestCounties(rows, METRICS.assistance.key)
      return counties.length
        ? `Social assistance was most common in ${county(counties[0].region_name)} in ${year}`
        : 'Social assistance by county'
    },
    note: 'Residents who received assistance during the year, %; tick: Sweden as a whole. Source: Kolada',
    render: () => <Ranks />,
  },
  {
    id: 'wel-income-scatter',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    title: (rows: CountyYear[]) => {
      const y = bothYears(rows).at(-1)
      if (y === undefined) return 'Income and social assistance by county'
      const r = pearson(dots(rows, y))
      return r < -0.3
        ? `In ${y}, counties with higher incomes had fewer residents on social assistance (r = ${fmt(r, 2)})`
        : `Income and social assistance by county, ${y} (r = ${fmt(r, 2)})`
    },
    note: 'Across: median earned income, SEK. Up: residents receiving social assistance, %. Source: Kolada',
    render: () => <IncomeScatter />,
  },
]
