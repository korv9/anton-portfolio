import TopicNav from '../TopicNav'
import { ProjectDepth } from '../projects/ProjectStructure'
import ProjectTech from '../projects/ProjectTech'
import { KpiRow, DashGrid } from '../ui/dash/Dash'
import { TraceResult } from '../ui/Trace'
import CountyMultiples from './CountyMultiples'
import {
  DataQuestion,
  ExploreSection,
  Interpretation,
  MethodSummary,
  StoryNext,
} from '../ui/Story'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { ProductQuality } from '../quality/QualityPanel'
import { ProjectHero } from '../ui/Project'
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
  const size = Math.abs(delta).toLocaleString(l('en-GB', 'sv-SE'), {
    maximumFractionDigits: 2,
  })
  const unit = indicator.unit?.startsWith('procent') ? l(' pp', ' p.e.') : ''
  return {
    text: `${delta > 0 ? '▲' : '▼'} ${size}${unit} ${l('since', 'sedan')} ${headline.previous_period_label}`,
    tone: better == null ? 'flat' : better ? 'better' : 'worse',
  }
}

export default function WelfarePage({ view }: { view: string }) {
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
      {view === '#sweden' ? (
        <ProjectHero
          project="welfare"
          question={l(
            'Which parts of Sweden do well or poorly, measure by measure?',
            'Var i Sverige går det bra och dåligt, mått för mått?',
          )}
          nav={[
            {
              href: '#sweden-counties',
              label: l('Compare counties', 'Jämför län'),
            },
            {
              href: '#sweden-explorer',
              label: l('Explore indicators', 'Utforska indikatorer'),
            },
            {
              href: '#data-catalogue',
              label: l('Pipeline status', 'Pipelinens status'),
            },
          ]}
        >
          <p>
            {l(
              'Unemployment, stress-related sick leave and sickness benefit in all 21 counties, on the same axis. Everything here is descriptive: it shows where measures differ and move together, not why.',
              'Arbetslöshet, stressrelaterad sjukskrivning och sjukpenning i alla 21 län, på samma axel. Allt här är beskrivande: det visar var måtten skiljer sig och följs åt, inte varför.',
            )}
          </p>
        </ProjectHero>
      ) : (
        <>
          <div className="page-lead welfare-lead">
            <DataQuestion
              level={1}
              eyebrow={l('How is Sweden doing?', 'Hur mår Sverige?')}
              question={l(
                'Which parts of Sweden do well or poorly, measure by measure?',
                'Var i Sverige går det bra och dåligt, mått för mått?',
              )}
            >
              <p>
                {l(
                  'Unemployment, stress-related sick leave and sickness benefit in all 21 counties, on the same axis. Everything here is descriptive: it shows where measures differ and move together, not why.',
                  'Arbetslöshet, stressrelaterad sjukskrivning och sjukpenning i alla 21 län, på samma axel. Allt här är beskrivande: det visar var måtten skiljer sig och följs åt, inte varför.',
                )}
              </p>
            </DataQuestion>
          </div>
          <TopicNav
            active={view}
            items={[
              ['#sweden', 'Overview', 'Översikt'],
              ['#sweden-counties', 'Compare counties', 'Jämför län'],
              [
                '#sweden-explorer',
                'Explore indicators',
                'Utforska indikatorer',
              ],
            ]}
          />
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {indicators.length > 0 && (
        <KpiRow
          items={[
            {
              label: l('Indicators', 'Indikatorer'),
              value: indicators.length.toLocaleString(l('en-GB', 'sv-SE')),
              note: l('In the published dataset', 'I publicerad data'),
            },
            {
              label: l('Sources', 'Källor'),
              value: new Set(
                indicators.map((i) => i.source_key),
              ).size.toLocaleString(l('en-GB', 'sv-SE')),
            },
            {
              label: l('Counties', 'Län'),
              value: new Set(
                counties.map((c) => c.region_code),
              ).size.toLocaleString(l('en-GB', 'sv-SE')),
              note: l('In the county comparison', 'I länsjämförelsen'),
            },
          ]}
        />
      )}

      {view === '#sweden' && (
        <section className="report welfare-section welfare-main">
          <DashGrid>
            <div className="welfare-chart-card">
              <CountyMultiples rows={counties} />
            </div>
            <ProjectTech project="welfare" span={4} />
          </DashGrid>
          <Interpretation
            notMeaning={l(
              'A county with high values on several measures is not shown to be worse off because of one thing: counties differ in age structure, industry and much else, and unemployment carries a margin of about ±1–2 points per county.',
              'Ett län med höga värden på flera mått visas inte vara sämre ställt av en enda orsak: länen skiljer sig i åldersstruktur, näringsliv och mycket annat, och arbetslösheten har en felmarginal på ungefär ±1–2 procentenheter per län.',
            )}
          >
            <p>
              {l(
                'Each small chart is one county on the same scale, so a shape that sits above the grey line is above the national average. Switch measure to see whether the same counties stand out on work and on health.',
                'Varje litet diagram är ett län på samma skala, så en kurva som ligger över den grå linjen ligger över rikssnittet. Byt mått för att se om samma län sticker ut för arbete och för hälsa.',
              )}
            </p>
          </Interpretation>
          <TraceResult
            node="out:welfare/*.json"
            what={l('the county figures', 'länssiffrorna')}
          />
          <DataQuestion
            eyebrow={l('Go deeper', 'Fördjupa')}
            question={l('Four questions to follow', 'Fyra frågor att följa')}
          />
          <StoryNext
            label={l('Welfare questions', 'Välfärdsfrågor')}
            links={[
              {
                href: '#sweden-counties',
                title: l('Work', 'Arbete'),
                line: l(
                  'Where is unemployment highest, and is it falling?',
                  'Var är arbetslösheten högst, och sjunker den?',
                ),
              },
              {
                href: '#sweden-counties',
                title: l('Health', 'Hälsa'),
                line: l(
                  'Where is sick leave highest?',
                  'Var är sjukskrivningen högst?',
                ),
              },
              {
                href: '#sweden-explorer',
                title: l('Trust', 'Tillit'),
                line: l(
                  'How much do people trust institutions and each other?',
                  'Hur stor är tilliten till institutioner och till varandra?',
                ),
              },
              {
                href: '#sweden-counties',
                title: l('Overlap', 'Samvariation'),
                line: l(
                  'Do unemployment, sick leave and mental strain move together?',
                  'Följs arbetslöshet, sjukskrivning och psykisk påfrestning åt?',
                ),
              },
            ]}
          />
        </section>
      )}
      {view === '#sweden' && (
        <div className="report welfare-section">
          <ExploreSection
            id="welfare-headlines"
            title={l(
              'Explore: the latest national values',
              'Utforska: senaste värden för riket',
            )}
            summary={l(
              `${indicators.length} indicators in ten areas, from jobs and health to trust and safety.`,
              `${indicators.length} indikatorer inom tio områden, från jobb och hälsa till tillit och trygghet.`,
            )}
          >
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
                  <article
                    key={headline.indicator_key}
                    className="welfare-tile"
                  >
                    <h3>{indicator.indicator_name}</h3>
                    <strong>
                      {formatValue(headline.value, indicator.unit)}
                    </strong>
                    <span className="tile-period">
                      {headline.period_label}
                      {headline.age_group_key !== 'ALL' &&
                        `, ${headline.age_group_key}`}
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
          </ExploreSection>
        </div>
      )}

      {view === '#sweden-counties' && (
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

      {view === '#sweden-explorer' && (
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
              fallback={
                <div className="loading">{l('Loading…', 'Laddar…')}</div>
              }
            >
              <WelfareExplorer indicators={indicators} />
            </Suspense>
          ) : (
            <div className="loading">{l('Loading…', 'Laddar…')}</div>
          )}
        </section>
      )}
      {view !== '#sweden' && <ProjectTech project="welfare" />}
      {view === '#sweden' && (
        <ProjectDepth project="welfare">
          <ExploreSection
            id="welfare-quality"
            title={l('Data quality', 'Datakvalitet')}
            summary={l(
              'Completeness, timeliness and the checks on every source.',
              'Fullständighet, aktualitet och kontrollerna av varje källa.',
            )}
          >
            <ProductQuality product="welfare" />
          </ExploreSection>
          <MethodSummary
            lineage={[
              'SCB, Försäkringskassan, Folkhälsomyndigheten, ESS, Kolada',
              l('Python ingestion', 'inläsning i Python'),
              'dbt + DuckDB',
              'Parquet, JSON',
              'React',
            ]}
            quality={l(
              'Five sources are joined on shared keys for region, period, sex and age; the relationships are descriptive only, and survey-based measures carry margins of error.',
              'Fem källor kopplas på gemensamma nycklar för region, period, kön och ålder; sambanden är bara beskrivande, och enkätbaserade mått har felmarginaler.',
            )}
            more={[
              {
                href: '#data-catalogue',
                label: l('Pipeline status', 'Pipelinens status'),
              },
              {
                href: 'https://github.com/korv9/anton-portfolio/blob/main/docs/welfare-data-model.md',
                label: l('Data model and caveats', 'Datamodell och förbehåll'),
              },
            ]}
          />
        </ProjectDepth>
      )}
    </div>
  )
}
