/**
 * The wellbeing report: work, health and the regional picture, one question per tab and at most
 * three charts in each. The reader follows counties; with none chosen a chart shows the highest
 * and the lowest county beside the mean. The indicator explorer is the deep dive behind it.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { WELFARE_TABS, setHashParams, type Route } from '../router'
import ReportShell, { DeepPage, ReportFrame } from '../report/ReportShell'
import { Feature } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import { Dumbbell } from '../charts/Compare'
import { Select } from '../politik/controls'
import CountyMultiples from './CountyMultiples'
import { fetchJson, type CountyYear, type Indicator } from './data'
import ReportMaps from '../clusters/ReportMaps'
import './welfare.css'

const WelfareExplorer = lazy(() => import('./WelfareExplorer'))

const NAME = 'Wellbeing Observatory'
type Key =
  | 'unemployment_rate_pct'
  | 'sick_pay_rate_days'
  | 'stress_cases_per_1000'
  | 'serious_mental_strain_pct'

const MEASURES: Record<Key, { label: string; unit: string; source: string }> = {
  unemployment_rate_pct: {
    label: 'Unemployment',
    unit: '%',
    source: 'SCB, Labour Force Survey (AKU), ages 15–74',
  },
  sick_pay_rate_days: {
    label: 'Sickness benefit days',
    unit: 'days',
    source: 'Försäkringskassan, sickness benefit rate 2.0, December',
  },
  stress_cases_per_1000: {
    label: 'Stress-related sick leave',
    unit: 'per 1,000',
    source:
      'Försäkringskassan, started sick-leave cases with a stress diagnosis (F43) per 1,000 inhabitants',
  },
  serious_mental_strain_pct: {
    label: 'Serious mental strain',
    unit: '%',
    source: 'Kolada N01452, share of the population',
  },
}

const TABS = [
  { label: 'Work', question: 'Where is unemployment highest?' },
  {
    label: 'Health and wellbeing',
    question: 'Where does work make people ill?',
  },
  {
    label: 'Regional differences',
    question: 'How do the counties compare?',
  },
  {
    label: 'Municipal profiles',
    question: 'Which municipalities look alike?',
  },
].map((tab, i) => ({ ...tab, path: WELFARE_TABS[i] }))

const DEEPER = [
  {
    href: '#sweden-explorer',
    label: 'Indicator explorer',
    about: 'Every indicator by region, period, sex and age',
  },
  {
    href: '#sweden-mental-health',
    label: 'Health indicators',
    about: 'Mental health and quality of life, measure by measure',
  },
]

const short = (name: string) => name.replace(/s? län$/, '')
const fmt = (v: number, unit = '') =>
  `${v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${unit === '%' ? ' %' : ''}`

function countiesOf(params: URLSearchParams) {
  return (params.get('lan') ?? '').split(',').filter(Boolean)
}
const withCounties = (path: string, codes: string[]) =>
  codes.length ? `${path}?lan=${codes.join(',')}` : path

type Props = { rows: CountyYear[]; followed: string[] }

/** The latest year a measure has values for, and its rows. */
function latestOf(rows: CountyYear[], key: Key) {
  const valued = rows.filter((r) => r[key] != null)
  const year = Math.max(...valued.map((r) => r.year))
  return { year, rows: valued.filter((r) => r.year === year), valued }
}

/** A measure over the years: the followed counties, or the highest and lowest, and the mean. */
function OverTime({
  id,
  measure,
  rows,
  followed,
}: Props & { id: string; measure: Key }) {
  const m = MEASURES[measure]
  const { rows: now, valued } = latestOf(rows, measure)
  const ranked = [...now].sort((a, b) => b[measure]! - a[measure]!)
  const codes = followed.length
    ? followed
    : [ranked[0].region_code, ranked.at(-1)!.region_code]
  const years = [...new Set(valued.map((r) => r.year))].sort()
  // The mean weighs each county by its population; it is not a separately measured rate.
  const mean = years.map((y) => {
    const at = valued.filter((r) => r.year === y && r.population)
    const people = at.reduce((s, r) => s + r.population!, 0)
    return {
      date: `${y}-01-01`,
      label: String(y),
      value: at.reduce((s, r) => s + r[measure]! * r.population!, 0) / people,
    }
  })
  const series = [
    { key: 'mean', name: 'All counties', points: mean },
    ...codes.map((code) => {
      const own = valued.filter((r) => r.region_code === code)
      return {
        key: code,
        name: short(own[0]?.region_name ?? code),
        points: own.map((r) => ({
          date: `${r.year}-01-01`,
          label: String(r.year),
          value: r[measure]!,
        })),
      }
    }),
  ]
  return (
    <Feature
      id={id}
      title={`${m.label}, ${years[0]}–${years.at(-1)}`}
      source={`${m.source}; all counties is a population-weighted mean of the counties`}
    >
      <MultiLineChart
        series={series}
        format={(v) => fmt(v, m.unit)}
        colorOf={(key) => series.findIndex((s) => s.key === key) + 1}
        label={`${m.label} per county and year`}
      />
    </Feature>
  )
}

/** The counties ranked on a measure in its latest year. */
function Ranked({
  id,
  measure,
  rows,
  followed,
}: Props & { id: string; measure: Key }) {
  const m = MEASURES[measure]
  const { year, rows: now } = latestOf(rows, measure)
  return (
    <Feature id={id} title={`${m.label} per county, ${year}`} source={m.source}>
      <RankBars
        rows={[...now]
          .sort((a, b) => b[measure]! - a[measure]!)
          .map((r) => ({
            key: r.region_code,
            label: short(r.region_name),
            value: r[measure]!,
            note:
              measure === 'unemployment_rate_pct' &&
              r.unemployment_rate_moe != null
                ? `±${r.unemployment_rate_moe}`
                : undefined,
          }))}
        format={(v) => fmt(v, m.unit)}
        picked={followed.length === 1 ? followed[0] : null}
        label={`${m.label} per county`}
      />
    </Feature>
  )
}

function Work({ rows, followed }: Props) {
  const measure = 'unemployment_rate_pct'
  const { year, rows: now, valued } = latestOf(rows, measure)
  const before = year - 10
  const moved = now
    .map((r) => ({
      key: r.region_code,
      label: short(r.region_name),
      to: r[measure]!,
      from: valued.find(
        (b) => b.region_code === r.region_code && b.year === before,
      )?.[measure],
    }))
    .filter((r): r is typeof r & { from: number } => r.from != null)
    .sort((a, b) => b.to - b.from - (a.to - a.from))
  return (
    <>
      <div className="report-main">
        <OverTime
          id="arbetsloshet"
          measure={measure}
          rows={rows}
          followed={followed}
        />
      </div>
      <div className="report-pair">
        <Ranked
          id="arbetsloshet-lan"
          measure={measure}
          rows={rows}
          followed={followed}
        />
        <Feature
          id="arbetsloshet-tio"
          title={`Unemployment, ${before} and ${year}`}
          source={MEASURES[measure].source}
        >
          <Dumbbell
            rows={moved}
            fromLabel={String(before)}
            toLabel={String(year)}
            format={(v) => fmt(v, '%')}
            label={`Unemployment per county, ${before} and ${year}`}
          />
        </Feature>
      </div>
    </>
  )
}

function Health({ rows, followed }: Props) {
  return (
    <>
      <div className="report-main">
        <OverTime
          id="stress"
          measure="stress_cases_per_1000"
          rows={rows}
          followed={followed}
        />
      </div>
      <div className="report-pair">
        <Ranked
          id="sjukpenning"
          measure="sick_pay_rate_days"
          rows={rows}
          followed={followed}
        />
        <Ranked
          id="pafrestning"
          measure="serious_mental_strain_pct"
          rows={rows}
          followed={followed}
        />
      </div>
    </>
  )
}

const KEYS = Object.keys(MEASURES) as Key[]

function Regional({ rows }: Props) {
  const [chosen, setChosen] = useState('')
  const [sortKey, setSortKey] = useState<Key>('unemployment_rate_pct')
  const years = [...new Set(rows.map((r) => r.year))].sort()
  // Open on the latest year where every measure has a value.
  const complete = years.filter((y) =>
    rows.some((r) => r.year === y && KEYS.every((k) => r[k] != null)),
  )
  const year = years.includes(Number(chosen))
    ? Number(chosen)
    : (complete.at(-1) ?? years.at(-1)!)
  const at = rows
    .filter((r) => r.year === year)
    .sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity))
  const range = (k: Key) => {
    const values = at.map((r) => r[k]).filter((v): v is number => v != null)
    return [Math.min(...values), Math.max(...values)]
  }
  return (
    <>
      <div className="report-main">
        <CountyMultiples rows={rows} />
      </div>
      <div className="report-main">
        <Feature
          id="lan-sida-vid-sida"
          title={`The four measures side by side, ${year}`}
          controls={
            <Select
              label="Year"
              value={String(year)}
              options={[...years]
                .reverse()
                .map((y) => ({ value: String(y), label: String(y) }))}
              onChange={setChosen}
            />
          }
          source="SCB, Försäkringskassan and Kolada; each column has its own unit and population, the bars compare counties within a column"
        >
          <div className="table-scroll" tabIndex={0}>
            <table className="welfare-table">
              <thead>
                <tr>
                  <th scope="col">County</th>
                  {KEYS.map((k) => (
                    <th
                      scope="col"
                      key={k}
                      aria-sort={sortKey === k ? 'descending' : 'none'}
                    >
                      <button type="button" onClick={() => setSortKey(k)}>
                        {MEASURES[k].label}
                        {sortKey === k ? ' ↓' : ''}
                      </button>
                      <small>{MEASURES[k].unit}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {at.map((r) => (
                  <tr key={r.region_code}>
                    <th scope="row">{short(r.region_name)}</th>
                    {KEYS.map((k) => {
                      const value = r[k]
                      const [low, high] = range(k)
                      return (
                        <td key={k}>
                          {value == null ? (
                            <span className="missing">–</span>
                          ) : (
                            <>
                              <span
                                className="cell-bar"
                                style={{
                                  width: `${8 + (high === low ? 0 : (value - low) / (high - low)) * 92}%`,
                                }}
                              />
                              <span className="cell-value">{fmt(value)}</span>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Feature>
      </div>
    </>
  )
}

function useCounties() {
  const [rows, setRows] = useState<CountyYear[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<CountyYear[]>('welfare/county-year.json')
      .then(setRows)
      .catch((e: Error) => setError(e.message))
  }, [])
  return { rows, error }
}

/** Municipalities grouped by twelve indicators, as a map to explore. */
function Profiles() {
  return <ReportMaps ids={['research-municipalities']} />
}

export default function WelfareReport({ route }: { route: Route }) {
  const { rows, error } = useCounties()
  const followed = countiesOf(route.params)
  const toggle = (code: string) => {
    // Four counties and the mean are the most one chart can keep apart.
    const next = followed.includes(code)
      ? followed.filter((c) => c !== code)
      : [...followed, code].slice(-4)
    const params = new URLSearchParams(route.params)
    if (next.length) params.set('lan', next.join(','))
    else params.delete('lan')
    setHashParams(route.path, params)
  }
  const counties = [
    ...new Map(
      (rows ?? []).map((r) => [r.region_code, r.region_name]),
    ).entries(),
  ]
  const at = Math.max(0, WELFARE_TABS.indexOf(route.path))
  const Body = [Work, Health, Regional, Profiles][at]
  return (
    <ReportFrame>
      <ReportShell
        name={NAME}
        intro="Unemployment, sick leave and self-reported health in Sweden’s 21 counties, from SCB, Försäkringskassan and Kolada. Every measure keeps its source’s definition."
        tabs={TABS}
        path={route.path}
        hrefOf={(p) => withCounties(p, followed)}
        slicerLabel="Follow counties"
        slicer={
          at < 3 && (
            <div className="report-chips" role="group" aria-label="Counties">
              {counties.map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={followed.includes(code)}
                  onClick={() => toggle(code)}
                >
                  {short(name)}
                </button>
              ))}
            </div>
          )
        }
        deeper={DEEPER}
      >
        {error && <p role="alert">{error}</p>}
        {!rows && !error && <p role="status">Loading…</p>}
        {rows && <Body rows={rows} followed={followed} />}
      </ReportShell>
    </ReportFrame>
  )
}

/** The indicator explorer on a page of its own; the health address opens it on health measures. */
export function WelfareDeep({ route }: { route: Route }) {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Indicator[]>('welfare/indicators.json')
      .then(setIndicators)
      .catch((e: Error) => setError(e.message))
  }, [])
  const health = route.path === '#sweden-mental-health'
  return (
    <ReportFrame>
      <DeepPage id={route.path.slice(1)} back="#sweden" name={NAME}>
        <h1>{health ? 'Health indicators' : 'Indicator explorer'}</h1>
        {error && <p role="alert">{error}</p>}
        <Suspense fallback={<p role="status">Loading…</p>}>
          {indicators.length > 0 && (
            <WelfareExplorer
              key={route.path}
              indicators={
                health
                  ? indicators.filter((i) =>
                      ['mental_halsa', 'halsa'].includes(i.domain),
                    )
                  : indicators
              }
            />
          )}
        </Suspense>
      </DeepPage>
    </ReportFrame>
  )
}
