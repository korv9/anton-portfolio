import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import {
  DOMAINS,
  fetchJson,
  formatValue,
  type CountyYear,
  type Headline,
  type Indicator,
} from './data'
import './welfare.css'

const WelfareExplorer = lazy(() => import('./WelfareExplorer'))

type CountyColumn = {
  key: keyof CountyYear
  label: [string, string]
  note: [string, string]
}

const COUNTY_COLUMNS: CountyColumn[] = [
  {
    key: 'unemployment_rate_pct',
    label: ['Unemployment %', 'Arbetslöshet %'],
    note: ['AKU, 15-74, annual', 'AKU, 15-74, år'],
  },
  {
    key: 'sick_pay_rate_days',
    label: ['Sick-pay days', 'Sjukpenningtal'],
    note: ['FK 2.0, December', 'FK 2.0, december'],
  },
  {
    key: 'stress_cases_per_1000',
    label: ['Stress cases / 1,000', 'Stressfall / 1 000'],
    note: ['FK F43, started in the year', 'FK F43, startade under året'],
  },
  {
    key: 'serious_mental_strain_pct',
    label: ['Serious mental strain %', 'Psykisk påfrestning %'],
    note: ['Kolada N01452', 'Kolada N01452'],
  },
]

function change(headline: Headline, indicator: Indicator) {
  if (headline.previous_value == null) return null
  const delta = headline.value - headline.previous_value
  if (Math.abs(delta) < 1e-9)
    return { text: l('unchanged', 'oförändrat'), tone: 'flat' }
  const better =
    indicator.higher_is_better == null
      ? null
      : delta > 0 === indicator.higher_is_better
  // A change in a share is in percentage points, not per cent.
  const size = Math.abs(delta).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
  const unit = indicator.unit?.startsWith('procent') ? l(' pp', ' p.e.') : ''
  return {
    text: `${delta > 0 ? '▲' : '▼'} ${size}${unit} ${l('since', 'sedan')} ${headline.previous_period_label}`,
    tone: better == null ? 'flat' : better ? 'better' : 'worse',
  }
}

export default function WelfarePage() {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [counties, setCounties] = useState<CountyYear[]>([])
  const [error, setError] = useState<string | null>(null)
  const [domain, setDomain] = useState('jobb')
  const [year, setYear] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<keyof CountyYear>(
    'unemployment_rate_pct',
  )

  useEffect(() => {
    Promise.all([
      fetchJson<Indicator[]>('welfare/indicators.json'),
      fetchJson<Headline[]>('welfare/headlines.json'),
      fetchJson<CountyYear[]>('welfare/county-year.json'),
    ])
      .then(([indicatorRows, headlineRows, countyRows]) => {
        setIndicators(indicatorRows)
        setHeadlines(headlineRows)
        setCounties(countyRows)
        // The latest year with every column filled, else the latest with unemployment.
        const complete = countyRows.filter((row) =>
          COUNTY_COLUMNS.every((column) => row[column.key] != null),
        )
        const pick = (complete.length ? complete : countyRows).map(
          (row) => row.year,
        )
        setYear(Math.max(...pick))
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const byKey = useMemo(
    () =>
      new Map(
        indicators.map((indicator) => [indicator.indicator_key, indicator]),
      ),
    [indicators],
  )
  const domains = useMemo(
    () =>
      Object.keys(DOMAINS).filter((key) =>
        indicators.some((i) => i.domain === key),
      ),
    [indicators],
  )
  const tiles = headlines.filter(
    (h) => byKey.get(h.indicator_key)?.domain === domain,
  )
  const years = [...new Set(counties.map((row) => row.year))].sort()
  const rows = counties
    .filter((row) => row.year === year)
    .sort(
      (a, b) =>
        Number(b[sortKey] ?? -Infinity) - Number(a[sortKey] ?? -Infinity),
    )
  const extremes = Object.fromEntries(
    COUNTY_COLUMNS.map((column) => {
      const values = rows
        .map((row) => row[column.key])
        .filter((v) => v != null) as number[]
      return [column.key, [Math.min(...values), Math.max(...values)]]
    }),
  )

  return (
    <div className="project-page welfare-page">
      <div className="page-lead">
        <p className="eyebrow">
          {l('Welfare · live public data', 'Välfärd · öppna data, löpande')}
        </p>
        <h1>{l('How is Sweden doing?', 'Hur mår Sverige?')}</h1>
        <p>
          {l(
            'Jobs, working life, health, wellbeing and trust from five public sources, joined on shared keys for region, period, sex and age. Refreshed daily from the sources. Everything here is descriptive: it shows how measures move together, not why.',
            'Jobb, arbetsliv, hälsa, mående och tillit från fem öppna källor, kopplade på gemensamma nycklar för region, period, kön och ålder. Uppdateras dagligen från källorna. Allt här är beskrivande: det visar hur mått samvarierar, inte varför.',
          )}
        </p>
        <p className="welfare-links">
          <a href="#status">{l('Pipeline status →', 'Pipelinens status →')}</a>
          <a
            href="https://github.com/korv9/anton-portfolio/blob/main/docs/welfare-data-model.md"
            target="_blank"
            rel="noreferrer"
          >
            {l('Data model and caveats ↗', 'Datamodell och förbehåll ↗')}
          </a>
        </p>
      </div>
      {error && <p role="alert">{error}</p>}

      <section
        className="report welfare-section"
        aria-labelledby="welfare-headlines"
      >
        <p className="eyebrow">
          {l('Latest national values', 'Senaste värden för riket')}
        </p>
        <h2 id="welfare-headlines">{l('Headline indicators', 'Nyckeltal')}</h2>
        <div className="segmented welfare-domains" role="tablist">
          {domains.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={domain === key}
              className={domain === key ? 'active' : ''}
              onClick={() => setDomain(key)}
            >
              {l(...DOMAINS[key])}
            </button>
          ))}
        </div>
        <div className="welfare-tiles">
          {tiles.map((headline) => {
            const indicator = byKey.get(headline.indicator_key)!
            const delta = change(headline, indicator)
            return (
              <article key={headline.indicator_key} className="welfare-tile">
                <h3>{indicator.indicator_name}</h3>
                <strong>{formatValue(headline.value, indicator.unit)}</strong>
                <span className="tile-period">
                  {headline.period_label}
                  {headline.age_group_key !== 'ALL' &&
                    ` · ${headline.age_group_key}`}
                </span>
                {headline.ci_low != null && headline.ci_high != null && (
                  <span className="tile-ci">
                    95 %: {formatValue(headline.ci_low, indicator.unit)}–
                    {formatValue(headline.ci_high, indicator.unit)}
                  </span>
                )}
                {delta && (
                  <span className={`tile-change ${delta.tone}`}>
                    {delta.text}
                  </span>
                )}
                <small>{indicator.source_name}</small>
              </article>
            )
          })}
        </div>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="welfare-counties"
      >
        <p className="eyebrow">
          {l('Counties side by side', 'Länen sida vid sida')}
        </p>
        <h2 id="welfare-counties">
          {l(
            'Do unemployment, sick leave and mental strain move together?',
            'Följs arbetslöshet, sjukskrivning och psykisk påfrestning åt?',
          )}
        </h2>
        <p className="welfare-note">
          {l(
            'Co-variation between counties, not cause and effect: counties differ in age structure, industry and much else these columns omit. Unemployment carries a margin of error of about ±1-2 points per county.',
            'Samvariation mellan län, inte orsak och verkan: länen skiljer sig i åldersstruktur, näringsliv och mycket annat som kolumnerna inte visar. Arbetslösheten har en felmarginal på ungefär ±1–2 procentenheter per län.',
          )}
        </p>
        <label className="welfare-year">
          {l('Year', 'År')}{' '}
          <select
            value={year ?? ''}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="table-scroll">
          <table className="welfare-table">
            <thead>
              <tr>
                <th scope="col">{l('County', 'Län')}</th>
                {COUNTY_COLUMNS.map((column) => (
                  <th
                    scope="col"
                    key={column.key}
                    aria-sort={sortKey === column.key ? 'descending' : 'none'}
                  >
                    <button onClick={() => setSortKey(column.key)}>
                      {l(...column.label)}
                      {sortKey === column.key ? ' ↓' : ''}
                    </button>
                    <small>{l(...column.note)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.region_code}>
                  <th scope="row">{row.region_name}</th>
                  {COUNTY_COLUMNS.map((column) => {
                    const value = row[column.key] as number | null
                    const [low, high] = extremes[column.key]
                    const share =
                      value == null || high === low
                        ? 0
                        : (value - low) / (high - low)
                    return (
                      <td key={column.key}>
                        {value == null ? (
                          <span className="missing">–</span>
                        ) : (
                          <>
                            <span
                              className="cell-bar"
                              style={{ width: `${8 + share * 92}%` }}
                            />
                            <span className="cell-value">
                              {value.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                              {column.key === 'unemployment_rate_pct' &&
                              row.unemployment_rate_moe != null
                                ? ` ±${row.unemployment_rate_moe}`
                                : ''}
                            </span>
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
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="welfare-explorer"
      >
        <p className="eyebrow">
          {l('Explore every indicator', 'Utforska alla indikatorer')}
        </p>
        <h2 id="welfare-explorer">
          {l('Build your own view', 'Bygg din egen vy')}
        </h2>
        {indicators.length ? (
          <Suspense
            fallback={<div className="loading">{l('Loading…', 'Laddar…')}</div>}
          >
            <WelfareExplorer indicators={indicators} />
          </Suspense>
        ) : (
          <div className="loading">{l('Loading…', 'Laddar…')}</div>
        )}
      </section>
    </div>
  )
}
