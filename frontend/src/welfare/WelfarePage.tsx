import { Suspense, lazy, useEffect, useState } from 'react'
import { l } from '../i18n'
import { ProjectDepth } from '../projects/ProjectStructure'
import ProjectTech from '../projects/ProjectTech'
import CountyMultiples from './CountyMultiples'
import { fetchJson, type CountyYear, type Indicator } from './data'
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

export default function WelfarePage({ view }: { view: string }) {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [counties, setCounties] = useState<CountyYear[]>([])
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<keyof CountyYear>(
    'unemployment_rate_pct',
  )
  useEffect(() => {
    Promise.all([
      fetchJson<Indicator[]>('welfare/indicators.json'),
      fetchJson<CountyYear[]>('welfare/county-year.json'),
    ])
      .then(([i, c]) => {
        setIndicators(i)
        setCounties(c)
        const complete = c.filter((row) =>
          COUNTY_COLUMNS.every((column) => row[column.key] != null),
        )
        setYear(
          Math.max(...(complete.length ? complete : c).map((row) => row.year)),
        )
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])
  const sick = view === '#sweden-sick-leave'
  const mental = view === '#sweden-mental-health'
  const regional = view === '#sweden-counties'
  const explorer = view === '#sweden-explorer' || mental
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
  const title = sick
    ? l('Sick leave', 'SjukfrÃ¥nvaro')
    : mental
      ? l('Mental health and quality of life', 'MÃ¥ende och livskvalitet')
      : regional
        ? l('Regional differences', 'Regionala skillnader')
        : explorer
          ? l('Indicator explorer', 'Utforska indikatorer')
          : l('Work and unemployment', 'Arbete och arbetslÃ¶shet')
  return (
    <article className="project-page welfare-page">
      <header className="page-lead">
        <p className="eyebrow">Wellbeing Observatory</p>
        <h1>{title}</h1>
        <p>
          {l(
            'Public statistics by period and geography. Each measure retains its source definition and population.',
            'Offentlig statistik efter period och geografi. Varje mÃ¥tt behÃ¥ller kÃ¤llans definition och mÃ¥lpopulation.',
          )}
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!error && !counties.length && (
        <p role="status">{l('Loadingâ€¦', 'Laddarâ€¦')}</p>
      )}
      {!regional && !explorer && counties.length > 0 && (
        <section className="project-section">
          <CountyMultiples
            key={view}
            rows={counties}
            initialKey={sick ? 'sick_pay_rate_days' : 'unemployment_rate_pct'}
            allowedKeys={
              sick
                ? ['sick_pay_rate_days', 'stress_cases_per_1000']
                : ['unemployment_rate_pct']
            }
          />
          <p className="reading-note">
            {l(
              'The grey reference is a total-population-weighted county mean, not a separately measured national rate. Unemployment uses ages 15â€“74 and includes sampling uncertainty.',
              'Den grÃ¥ referensen Ã¤r ett lÃ¤nssnitt viktat med total befolkning, inte ett separat uppmÃ¤tt riksvÃ¤rde. ArbetslÃ¶sheten avser 15â€“74 Ã¥r och har urvalsosÃ¤kerhet.',
            )}
          </p>
        </section>
      )}
      {regional && (
        <section className="project-section">
          <h2>
            {l('County measures side by side', 'LÃ¤nens mÃ¥tt sida vid sida')}
          </h2>
          <p>
            {l(
              'Columns have separate units and populations. Bars compare counties within a column.',
              'Kolumnerna har olika enheter och mÃ¥lpopulationer. Staplarna jÃ¤mfÃ¶r lÃ¤n inom varje kolumn.',
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
                                {value.toLocaleString(l('en-GB', 'sv-SE'), {
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
      )}
      {explorer && indicators.length > 0 && (
        <section className="project-section">
          <Suspense
            fallback={<p role="status">{l('Loadingâ€¦', 'Laddarâ€¦')}</p>}
          >
            <WelfareExplorer
              key={view}
              indicators={
                mental
                  ? indicators.filter((i) =>
                      ['mental_halsa', 'halsa'].includes(i.domain),
                    )
                  : indicators
              }
            />
          </Suspense>
        </section>
      )}
      <ProjectDepth project="welfare">
        <ProjectTech project="welfare" />
      </ProjectDepth>
    </article>
  )
}
