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
import { Ranked, fmt, maxOf, num, pct } from './wel-kit'
import { l } from '../../i18n'

const usePanel = () => useData<CountyYear[]>('welfare/panel-county-year.json')

const TURNOUT = 'turnout_riksdag_pct'

/** Riksdag general elections (every four years since 1994). The panel repeats each result
 * in the years until the next election, so only these years are shown. */
const RIKSDAG_ELECTIONS = [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026]

/** The election years the panel has county turnout for. */
const elections = (rows: CountyYear[]) =>
  RIKSDAG_ELECTIONS.filter((y) =>
    rows.some((r) => !r.is_country && r.year === y && num(r[TURNOUT])),
  )

const turnoutIn = (rows: CountyYear[], year: number) =>
  rows.filter((r) => r.year === year && num(r[TURNOUT]))

function Turnout() {
  const data = usePanel()
  const [yr, setYr] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(rows) => {
        const opts = elections(rows)
        const year = yr ?? opts.at(-1)
        if (year === undefined) return null
        const at = turnoutIn(rows, year)
        const nation = at.find((r) => r.is_country)?.[TURNOUT]
        return (
          <>
            <Slicer
              label={l('Election year', 'Valår')}
              cycles
              options={opts}
              value={year}
              onChange={setYr}
            />
            <Ranked
              label={l(
                `Turnout in the ${year} Riksdag election by county, %; tick: Sweden as a whole`,
                `Valdeltagande i riksdagsvalet ${year} per län, %; streck: hela Sverige`,
              )}
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
  const year = maxOf(ok.map((r) => r.year))
  const at = ok.filter((r) => r.year === year)
  return {
    period: String(at[0]?.fohm_period ?? year ?? ''),
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
          label={l(
            'Share in good health against the share who find it hard to trust others, one dot per county',
            'Andel med god hälsa mot andel som har svårt att lita på andra, en punkt per län',
          )}
          xFormat={(v) => pct(v, 1)}
          yFormat={(v) => pct(v, 1)}
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
      const topic = l(
        'Riksdag election turnout by county',
        'Valdeltagande i riksdagsvalet per län',
      )
      if (year === undefined) return topic
      const v = turnoutIn(rows, year)
        .filter((r) => !r.is_country)
        .map((r) => r[TURNOUT] as number)
      if (!v.length) return topic
      const [lo, hi] = [pct(Math.min(...v), 0), pct(Math.max(...v), 0)]
      return l(
        `Turnout in the ${year} Riksdag election ranged from ${lo} to ${hi} across counties`,
        `Valdeltagandet i riksdagsvalet ${year} varierade mellan ${lo} och ${hi} i länen`,
      )
    },
    note: [
      'Share of eligible voters who voted; tick: Sweden as a whole. Source: Kolada',
      'Andel röstberättigade som röstade; streck: hela Sverige. Källa: Kolada',
    ],
    render: () => <Turnout />,
  },
  {
    id: 'wel-health-trust',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    title: (rows: CountyYear[]) => {
      const { period, dots } = healthTrust(rows)
      const topic = l('Health and trust by county', 'Hälsa och tillit per län')
      if (dots.length < 3) return topic
      const r = pearson(dots)
      if (r === null) return `${topic}, ${period}`
      const link =
        Math.abs(r) < 0.3
          ? l('barely related', 'knappt sammanhängande')
          : r < 0
            ? l(
                'related: better health, less distrust',
                'sammanhängande: bättre hälsa, mindre misstro',
              )
            : l(
                'related: better health, more distrust',
                'sammanhängande: bättre hälsa, mer misstro',
              )
      return l(
        `Across counties, good health and distrust were ${link} in ${period} (r = ${fmt(r, 2)})`,
        `Mellan länen var god hälsa och misstro ${link} ${period} (r = ${fmt(r, 2)})`,
      )
    },
    note: [
      'Across: rate their health as good, %. Up: find it hard to trust others, %. Source: Folkhälsomyndigheten',
      'Vågrätt: bedömer sin hälsa som god, %. Lodrätt: har svårt att lita på andra, %. Källa: Folkhälsomyndigheten',
    ],
    render: () => <HealthTrust />,
  },
]
