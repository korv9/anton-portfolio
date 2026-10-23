/** The county-year welfare panel: turnout by county, and health against trust. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import {
  Scatter,
  county,
  pearson,
  type CountyYear,
  type Dot,
} from './wel-charts'
import { Ranked, fmt, num, pct } from './wel-kit'

const usePanel = () => useData<CountyYear[]>('welfare/panel-county-year.json')

const TURNOUT = 'turnout_riksdag_pct'

/** Election years: the panel repeats each result until the next election, so a year counts
 * only where the national turnout changes. */
function elections(rows: CountyYear[]) {
  const nat = rows
    .filter((r) => r.is_country && num(r[TURNOUT]))
    .sort((a, b) => a.year - b.year)
  return nat
    .filter((r, i) => i > 0 && r[TURNOUT] !== nat[i - 1][TURNOUT])
    .map((r) => r.year)
}

const turnoutIn = (rows: CountyYear[], year: number) =>
  rows.filter((r) => r.year === year && num(r[TURNOUT]))

function Turnout() {
  const data = usePanel()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(rows) => {
        const opts = elections(rows)
        const year = yr ?? opts[opts.length - 1]
        const at = turnoutIn(rows, year)
        const nation = at.find((r) => r.is_country)?.[TURNOUT]
        return (
          <>
            <Slicer
              label="Election year"
              cycles
              options={opts}
              value={year}
              onChange={setYr}
            />
            <Ranked
              label={`Turnout in the ${year} Riksdag election by county, %; tick: Sweden as a whole`}
              max={100}
              format={(v) => pct(v, 0)}
              mark={num(nation) ? nation : undefined}
              rows={at
                .filter((r) => !r.is_country)
                .map((r) => ({
                  key: r.region_code,
                  label: county(r.region_name),
                  value: r[TURNOUT] as number,
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

const HEALTH = 'fohm_good_health_pct'
const TRUST = 'fohm_hard_to_trust_pct'

/** The latest pooled survey period with both measures, as county dots. */
function healthTrust(rows: CountyYear[]) {
  const ok = rows.filter(
    (r) => !r.is_country && num(r[HEALTH]) && num(r[TRUST]),
  )
  const year = Math.max(...ok.map((r) => r.year))
  const at = ok.filter((r) => r.year === year)
  return {
    period: String(at[0]?.fohm_period ?? year),
    dots: at.map((r): Dot => ({
      key: r.region_code,
      name: county(r.region_name),
      x: r[HEALTH] as number,
      y: r[TRUST] as number,
    })),
  }
}

function HealthTrust() {
  return (
    <Frame data={usePanel()}>
      {(rows) => (
        <Scatter
          dots={healthTrust(rows).dots}
          label="Share in good health against the share who find it hard to trust others, one dot per county"
          xFormat={(v) => `${v}%`}
          yFormat={(v) => `${v}%`}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-turnout-lollipop',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    title: (rows: CountyYear[]) => {
      const year = elections(rows).at(-1)
      if (year === undefined) return 'Riksdag election turnout by county'
      const v = turnoutIn(rows, year)
        .filter((r) => !r.is_country)
        .map((r) => r[TURNOUT] as number)
      return `Turnout in the ${year} Riksdag election ranged from ${pct(Math.min(...v), 0)} to ${pct(Math.max(...v), 0)} across counties`
    },
    note: 'Share of eligible voters who voted; tick: Sweden as a whole. Source: Kolada',
    render: () => <Turnout />,
  },
  {
    id: 'wel-health-trust',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    title: (rows: CountyYear[]) => {
      const { period, dots } = healthTrust(rows)
      if (dots.length < 3) return 'Health and trust by county'
      const r = pearson(dots)
      const link =
        Math.abs(r) < 0.3
          ? 'barely related'
          : r < 0
            ? 'related: better health, less distrust'
            : 'related: better health, more distrust'
      return `Across counties, good health and distrust were ${link} in ${period} (r = ${fmt(r, 2)})`
    },
    note: 'Across: rate their health as good, %. Up: find it hard to trust others, %. Source: Folkhälsomyndigheten',
    render: () => <HealthTrust />,
  },
]
