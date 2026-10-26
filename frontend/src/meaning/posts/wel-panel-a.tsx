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
import { l } from '../../i18n'

/** The panel's measures, in plain words with their units. Turnout has its own post. */
const METRICS: Record<string, CountyMetric> = {
  assistance: {
    field: 'social_assistance_pct',
    name: [
      'residents receiving social assistance, %',
      'invånare med ekonomiskt bistånd, %',
    ],
    format: (v) => pct(v),
  },
  income: {
    field: 'median_earned_income_sek',
    name: ['median earned income, SEK', 'medianförvärvsinkomst, kr'],
    format: (v) => fmt(v, 0),
  },
  'ill health': {
    field: 'ill_health_days',
    name: [
      'ill-health days per person aged 16–64',
      'ohälsodagar per person 16–64 år',
    ],
    format: (v) => fmt(v, 1),
  },
  crime: {
    field: 'violent_crime_per_100k',
    name: [
      'reported violent crimes per 100,000 inhabitants',
      'anmälda våldsbrott per 100 000 invånare',
    ],
    format: (v) => fmt(v, 0),
  },
  'sick leave': {
    field: 'ongoing_sick_leave_per_1000',
    name: [
      'ongoing sick-leave cases per 1,000 inhabitants',
      'pågående sjukfall per 1 000 invånare',
    ],
    format: (v) => fmt(v, 1),
  },
  employment: {
    field: 'employment_rate_pct',
    name: [
      'employment rate, % of people aged 15–74',
      'sysselsättningsgrad, % av 15–74 år',
    ],
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
        const year = yr ?? ys.at(-1)
        if (year === undefined) return null
        return (
          <>
            <Slicer
              label={l('Year', 'År')}
              cycles
              options={ys.filter((v) => (ys.at(-1)! - v) % 4 === 0)}
              value={year}
              onChange={setYr}
            />
            <Scatter
              dots={dots(rows, year)}
              all={ys.flatMap((y) => dots(rows, y))}
              label={l(
                'Median earned income against the share of residents receiving social assistance, one dot per county',
                'Medianförvärvsinkomst mot andelen invånare med ekonomiskt bistånd, en punkt per län',
              )}
              xFormat={(v) => `${fmt(v / 1000, 0)}${l('k', '\u00a0tkr')}`}
              yFormat={(v) => pct(v, 1)}
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
      const { year, counties } = latestCounties(rows, METRICS.assistance.field)
      return year !== null && counties.length
        ? l(
            `Social assistance was most common in ${county(counties[0].region_name)} in ${year}`,
            `Ekonomiskt bistånd var vanligast i ${county(counties[0].region_name)} ${year}`,
          )
        : l('Social assistance by county', 'Ekonomiskt bistånd per län')
    },
    note: [
      'Residents who received assistance during the year, %; tick: Sweden as a whole. Source: Kolada',
      'Invånare som fick bistånd under året, %; streck: hela Sverige. Källa: Kolada',
    ],
    render: () => <Ranks />,
  },
  {
    id: 'wel-income-scatter',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    title: (rows: CountyYear[]) => {
      const y = bothYears(rows).at(-1)
      const topic = l(
        'Income and social assistance by county',
        'Inkomst och ekonomiskt bistånd per län',
      )
      if (y === undefined) return topic
      const r = pearson(dots(rows, y))
      if (r === null) return `${topic}, ${y}`
      const link =
        r <= -0.3
          ? l(
              'counties with higher incomes had fewer residents on social assistance',
              'hade län med högre inkomster färre invånare med ekonomiskt bistånd',
            )
          : r >= 0.3
            ? l(
                'counties with higher incomes had more residents on social assistance',
                'hade län med högre inkomster fler invånare med ekonomiskt bistånd',
              )
            : l(
                'income and social assistance were barely related across counties',
                'hängde inkomst och ekonomiskt bistånd knappt ihop mellan länen',
              )
      return l(
        `In ${y}, ${link} (r = ${fmt(r, 2)})`,
        `${y} ${link} (r = ${fmt(r, 2)})`,
      )
    },
    note: [
      'Across: median earned income, SEK. Up: residents receiving social assistance, %. Source: Kolada',
      'Vågrätt: medianförvärvsinkomst, kr. Lodrätt: invånare med ekonomiskt bistånd, %. Källa: Kolada',
    ],
    render: () => <IncomeScatter />,
  },
]
